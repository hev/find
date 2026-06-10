package ask

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
)

const (
	anthropicMessagesURL = "https://api.anthropic.com/v1/messages"
	anthropicVersion     = "2023-06-01"
	defaultDigestModel   = "claude-opus-4-8"
	// MaxSingleShotCorpusBytes is the hard ceiling for the one-call `digest build`
	// path; bigger corpora must use the sharded flow.
	MaxSingleShotCorpusBytes = 600_000
)

type BuildDigestOptions struct {
	BuildOptions
	DigestModel string
	// Provider selects the inference provider: anthropic (default), openai, or
	// openrouter. Each reads its own key env var when APIKey is unset.
	Provider string
	// ProviderBaseURL overrides the OpenAI-compatible API base, so any Chat
	// Completions endpoint works.
	ProviderBaseURL string
	APIKey          string
	APIURL          string
	HTTPClient      *http.Client
}

func BuildDigest(options BuildDigestOptions) (BuildResult, error) {
	normalizeBuildOptions(&options.BuildOptions)
	provider, err := ResolveProvider(options.Provider)
	if err != nil {
		return BuildResult{}, err
	}
	if options.DigestModel == "" {
		options.DigestModel = provider.DefaultDigestModel
	}
	corpus, err := BuildCorpus(options.BuildOptions)
	if err != nil {
		return BuildResult{}, err
	}
	outPath := resolveSitePath(options.SiteRoot, options.DigestPath)
	existing, err := LoadDigest(outPath)
	if err == nil && existing.Version == 2 && existing.ContentHash == corpus.ContentHash && len(existing.Nodes) > 0 {
		return BuildResult{Status: "skipped", Path: outPath, ContentHash: corpus.ContentHash, Chunks: len(corpus.Chunks)}, nil
	}
	changed := corpus.Chunks
	if err == nil && existing.Version == 2 && len(existing.Nodes) > 0 {
		changed = changedChunks(corpus.Chunks, existing)
		if len(changed) == 0 {
			refreshed := digestWithContentHash(existing, corpus.ContentHash)
			if err := WriteDigest(outPath, refreshed); err != nil {
				return BuildResult{}, err
			}
			return BuildResult{Status: "skipped", Path: outPath, ContentHash: corpus.ContentHash, Chunks: len(corpus.Chunks)}, nil
		}
	}

	// The single-shot build hands the whole corpus to one model call. Past this
	// size the distillation degrades (or truncates), so fail loudly and point
	// at the sharded flow — same policy as the max_tokens truncation check.
	if size := len(renderCorpusText(CorpusSections(CorpusBuild{Chunks: changed}))); size > MaxSingleShotCorpusBytes {
		return BuildResult{}, fmt.Errorf(
			"corpus is ~%dKB of text — too large for a single-shot digest build (limit ~%dKB); shard it instead: `ask digest corpus --shards-dir .hev-ask/shards`, distil each shard with the build-digest skill, then `ask digest assemble --input-dir .hev-ask/shards`",
			size/1024, MaxSingleShotCorpusBytes/1024,
		)
	}

	apiKey := options.APIKey
	if apiKey == "" {
		apiKey = os.Getenv(provider.EnvKey)
	}
	if apiKey == "" {
		return BuildResult{}, fmt.Errorf("%s is required to build a fresh digest", provider.EnvKey)
	}

	emitted, err := callDigestModel(options, provider, apiKey, CorpusBuild{Chunks: changed, ContentHash: corpus.ContentHash})
	if err != nil {
		return BuildResult{}, err
	}
	if len(changed) < len(corpus.Chunks) {
		emitted = mergeIncrementalDistillation(existing, emitted, changed)
	}
	digest := AssembleDigest(emitted, corpus)
	if err := WriteDigest(outPath, digest); err != nil {
		return BuildResult{}, err
	}
	return BuildResult{Status: "built", Path: outPath, ContentHash: corpus.ContentHash, Chunks: len(corpus.Chunks)}, nil
}

func changedChunks(chunks []Chunk, existing Digest) []Chunk {
	byID := map[string]DigestNode{}
	for _, node := range existing.Nodes {
		byID[node.ID] = node
	}
	changed := make([]Chunk, 0, len(chunks))
	for _, chunk := range chunks {
		node, ok := byID[chunk.ID]
		if !ok || strings.TrimSpace(node.Summary) == "" || node.Hash == "" || node.Hash != SectionHash(chunk) {
			changed = append(changed, chunk)
		}
	}
	return changed
}

func mergeIncrementalDistillation(existing Digest, emitted EmittedDistillation, changed []Chunk) EmittedDistillation {
	changedIDs := map[string]bool{}
	for _, chunk := range changed {
		changedIDs[chunk.ID] = true
	}
	summaries := make([]SectionSummaryIn, 0, len(existing.Nodes)+len(emitted.Summaries))
	for _, node := range existing.Nodes {
		if !changedIDs[node.ID] && strings.TrimSpace(node.Summary) != "" {
			summaries = append(summaries, SectionSummaryIn{ID: node.ID, Summary: node.Summary})
		}
	}
	summaries = append(summaries, emitted.Summaries...)
	sort.Slice(summaries, func(i, j int) bool { return summaries[i].ID < summaries[j].ID })
	return EmittedDistillation{
		Context:     firstNonEmpty(existing.Context, emitted.Context),
		Glossary:    existing.Glossary,
		Summaries:   summaries,
		Suggestions: existing.Suggestions,
	}
}

func digestWithContentHash(digest Digest, contentHash string) Digest {
	digest.ContentHash = contentHash
	return digest
}

func callDigestModel(options BuildDigestOptions, provider Provider, apiKey string, corpus CorpusBuild) (EmittedDistillation, error) {
	if provider.Name == "anthropic" {
		return callAnthropicDigestModel(options, apiKey, corpus)
	}
	return callOpenAIDigestModel(options, provider, apiKey, corpus)
}

const digestUserMessage = "Emit the context, glossary, one summary per section id, and 3-5 suggested questions. " +
	"Every id in the corpus must get a summary."

func callAnthropicDigestModel(options BuildDigestOptions, apiKey string, corpus CorpusBuild) (EmittedDistillation, error) {
	corpusText := renderCorpusText(CorpusSections(corpus))
	// One summary per section makes the output scale with corpus size; a tight
	// cap starves the trailing schema keys (the model emits suggestions last
	// and returns [] when it runs low), so give it generous headroom.
	body := map[string]any{
		"model":      options.DigestModel,
		"max_tokens": 32000,
		"system": []map[string]any{
			{
				"type": "text",
				"text": digestSystemPrompt,
			},
			{
				"type":          "text",
				"text":          "<corpus>\n" + corpusText + "\n</corpus>",
				"cache_control": map[string]string{"type": "ephemeral"},
			},
		},
		"messages": []map[string]any{
			{
				"role":    "user",
				"content": digestUserMessage,
			},
		},
		"tools": []map[string]any{digestTool()},
		"tool_choice": map[string]string{
			"type": "tool",
			"name": "emit_digest",
		},
	}
	data, err := json.Marshal(body)
	if err != nil {
		return EmittedDistillation{}, err
	}
	apiURL := options.APIURL
	if apiURL == "" {
		apiURL = anthropicMessagesURL
	}
	request, err := http.NewRequest(http.MethodPost, apiURL, bytes.NewReader(data))
	if err != nil {
		return EmittedDistillation{}, err
	}
	request.Header.Set("content-type", "application/json")
	request.Header.Set("x-api-key", apiKey)
	request.Header.Set("anthropic-version", anthropicVersion)

	client := options.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}
	response, err := client.Do(request)
	if err != nil {
		return EmittedDistillation{}, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		detail, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return EmittedDistillation{}, fmt.Errorf("Anthropic API %d: %s", response.StatusCode, strings.TrimSpace(string(detail)))
	}

	var payload struct {
		StopReason string `json:"stop_reason"`
		Content    []struct {
			Type  string          `json:"type"`
			Name  string          `json:"name"`
			Input json.RawMessage `json:"input"`
		} `json:"content"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return EmittedDistillation{}, fmt.Errorf("decode Anthropic response: %w", err)
	}
	if payload.StopReason == "max_tokens" {
		return EmittedDistillation{}, fmt.Errorf("digest emission hit the max_tokens cap; the corpus may be too large for one pass")
	}
	for _, block := range payload.Content {
		if block.Type != "tool_use" || block.Name != "emit_digest" {
			continue
		}
		var emitted EmittedDistillation
		if err := json.Unmarshal(block.Input, &emitted); err != nil {
			return EmittedDistillation{}, fmt.Errorf("parse digest tool input: %w", err)
		}
		normalizeDistillation(&emitted)
		return emitted, nil
	}
	return EmittedDistillation{}, fmt.Errorf("Anthropic response did not include emit_digest tool use")
}

// callOpenAIDigestModel speaks the OpenAI Chat Completions dialect, which
// covers OpenAI, OpenRouter, and any compatible endpoint via ProviderBaseURL.
func callOpenAIDigestModel(options BuildDigestOptions, provider Provider, apiKey string, corpus CorpusBuild) (EmittedDistillation, error) {
	corpusText := renderCorpusText(CorpusSections(corpus))
	// OpenAI's reasoning models reject `max_tokens`; OpenRouter normalizes it.
	tokenParam := "max_tokens"
	if provider.Name == "openai" {
		tokenParam = "max_completion_tokens"
	}
	tool := digestTool()
	body := map[string]any{
		"model":    options.DigestModel,
		tokenParam: 32000,
		"messages": []map[string]any{
			{
				"role":    "system",
				"content": digestSystemPrompt + "\n\n<corpus>\n" + corpusText + "\n</corpus>",
			},
			{
				"role":    "user",
				"content": digestUserMessage,
			},
		},
		"tools": []map[string]any{
			{
				"type": "function",
				"function": map[string]any{
					"name":        tool["name"],
					"description": tool["description"],
					"parameters":  tool["input_schema"],
				},
			},
		},
		"tool_choice": map[string]any{
			"type":     "function",
			"function": map[string]string{"name": "emit_digest"},
		},
	}
	data, err := json.Marshal(body)
	if err != nil {
		return EmittedDistillation{}, err
	}
	apiURL := options.APIURL
	if apiURL == "" {
		base := options.ProviderBaseURL
		if base == "" {
			base = provider.BaseURL
		}
		apiURL = strings.TrimRight(base, "/") + "/chat/completions"
	}
	request, err := http.NewRequest(http.MethodPost, apiURL, bytes.NewReader(data))
	if err != nil {
		return EmittedDistillation{}, err
	}
	request.Header.Set("content-type", "application/json")
	request.Header.Set("authorization", "Bearer "+apiKey)

	client := options.HTTPClient
	if client == nil {
		client = http.DefaultClient
	}
	response, err := client.Do(request)
	if err != nil {
		return EmittedDistillation{}, err
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		detail, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return EmittedDistillation{}, fmt.Errorf("%s API %d: %s", provider.Label, response.StatusCode, strings.TrimSpace(string(detail)))
	}

	var payload struct {
		Choices []struct {
			FinishReason string `json:"finish_reason"`
			Message      struct {
				ToolCalls []struct {
					Function struct {
						Name      string `json:"name"`
						Arguments string `json:"arguments"`
					} `json:"function"`
				} `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return EmittedDistillation{}, fmt.Errorf("decode %s response: %w", provider.Label, err)
	}
	if len(payload.Choices) == 0 {
		return EmittedDistillation{}, fmt.Errorf("%s response had no choices", provider.Label)
	}
	choice := payload.Choices[0]
	if choice.FinishReason == "length" {
		return EmittedDistillation{}, fmt.Errorf("digest emission hit the max_tokens cap; the corpus may be too large for one pass")
	}
	for _, call := range choice.Message.ToolCalls {
		if call.Function.Name != "emit_digest" {
			continue
		}
		var emitted EmittedDistillation
		if err := json.Unmarshal([]byte(call.Function.Arguments), &emitted); err != nil {
			return EmittedDistillation{}, fmt.Errorf("parse digest tool input: %w", err)
		}
		normalizeDistillation(&emitted)
		return emitted, nil
	}
	return EmittedDistillation{}, fmt.Errorf("%s response did not include emit_digest tool use", provider.Label)
}

func renderCorpusText(sections []CorpusSection) string {
	parts := make([]string, 0, len(sections))
	for _, section := range sections {
		parts = append(parts, "id: "+section.ID+"\nurl: "+section.URL+"\ntitle: "+section.Title+"\n\n"+section.Text)
	}
	return strings.Join(parts, "\n\n---\n\n")
}

const digestSystemPrompt = "You build documentation digests for an AI search agent. Return only the forced tool call. " +
	"Write a compact orientation, a glossary with aliases real users would type, one tight summary for every section id in the corpus, " +
	"and 3-5 natural questions a reader might ask that these docs answer. Summaries are what the agent reasons from, so make them faithful " +
	"and self-contained; paraphrase prose but never restate code, flags, or exact identifiers."

func digestTool() map[string]any {
	return map[string]any{
		"name":        "emit_digest",
		"description": "Emit a documentation digest: a compact orientation, a glossary, and one distilled summary per section.",
		"input_schema": map[string]any{
			"type": "object",
			"properties": map[string]any{
				"context": map[string]any{
					"type":        "string",
					"description": "Compact markdown orientation explaining the product, core concepts, feature areas, and how users talk about them.",
				},
				"glossary": map[string]any{
					"type": "array",
					"items": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"term":       map[string]any{"type": "string"},
							"aliases":    map[string]any{"type": "array", "items": map[string]any{"type": "string"}},
							"definition": map[string]any{"type": "string"},
						},
						"required": []string{"term", "aliases", "definition"},
					},
				},
				"summaries": map[string]any{
					"type":        "array",
					"description": "One entry per section id in the corpus. The summary is the agent-facing distillation of that section.",
					"items": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"id":      map[string]any{"type": "string", "description": "The exact section id from the corpus."},
							"summary": map[string]any{"type": "string", "description": "A tight 1-3 sentence distillation of the section."},
						},
						"required": []string{"id", "summary"},
					},
				},
				"suggestions": map[string]any{
					"type":        "array",
					"description": "3-5 natural questions a real reader might ask that these docs genuinely answer.",
					"items":       map[string]any{"type": "string"},
				},
			},
			"required": []string{"context", "glossary", "summaries", "suggestions"},
		},
	}
}
