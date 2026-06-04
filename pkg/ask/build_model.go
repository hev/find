package ask

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

const (
	anthropicMessagesURL = "https://api.anthropic.com/v1/messages"
	anthropicVersion     = "2023-06-01"
	defaultKGModel       = "claude-opus-4-8"
)

type BuildKnowledgeGraphOptions struct {
	BuildOptions
	KGModel    string
	APIKey     string
	APIURL     string
	HTTPClient *http.Client
}

func BuildKnowledgeGraph(options BuildKnowledgeGraphOptions) (BuildResult, error) {
	normalizeBuildOptions(&options.BuildOptions)
	if options.KGModel == "" {
		options.KGModel = defaultKGModel
	}
	corpus, err := BuildCorpus(options.BuildOptions)
	if err != nil {
		return BuildResult{}, err
	}
	outPath := resolveSitePath(options.SiteRoot, options.KGPath)
	existing, err := LoadGraph(outPath)
	if err == nil && existing.Version == 2 && existing.ContentHash == corpus.ContentHash && len(existing.Nodes) > 0 {
		return BuildResult{Status: "skipped", Path: outPath, ContentHash: corpus.ContentHash, Chunks: len(corpus.Chunks)}, nil
	}

	apiKey := options.APIKey
	if apiKey == "" {
		apiKey = os.Getenv("ANTHROPIC_API_KEY")
	}
	if apiKey == "" {
		return BuildResult{}, fmt.Errorf("ANTHROPIC_API_KEY is required to build a fresh knowledge graph")
	}

	emitted, err := callKnowledgeGraphModel(options, apiKey, corpus)
	if err != nil {
		return BuildResult{}, err
	}
	graph := AssembleGraph(emitted, corpus)
	if err := WriteGraph(outPath, graph); err != nil {
		return BuildResult{}, err
	}
	return BuildResult{Status: "built", Path: outPath, ContentHash: corpus.ContentHash, Chunks: len(corpus.Chunks)}, nil
}

func callKnowledgeGraphModel(options BuildKnowledgeGraphOptions, apiKey string, corpus CorpusBuild) (EmittedDistillation, error) {
	corpusText := renderCorpusText(CorpusSections(corpus))
	body := map[string]any{
		"model":      options.KGModel,
		"max_tokens": 8192,
		"system": []map[string]any{
			{
				"type": "text",
				"text": kgSystemPrompt,
			},
			{
				"type":          "text",
				"text":          "<corpus>\n" + corpusText + "\n</corpus>",
				"cache_control": map[string]string{"type": "ephemeral"},
			},
		},
		"messages": []map[string]any{
			{
				"role": "user",
				"content": "Emit the context, glossary, one summary per section id, and 3-5 suggested questions. " +
					"Every id in the corpus must get a summary.",
			},
		},
		"tools": []map[string]any{knowledgeGraphTool()},
		"tool_choice": map[string]string{
			"type": "tool",
			"name": "emit_knowledge_graph",
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
		Content []struct {
			Type  string          `json:"type"`
			Name  string          `json:"name"`
			Input json.RawMessage `json:"input"`
		} `json:"content"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		return EmittedDistillation{}, fmt.Errorf("decode Anthropic response: %w", err)
	}
	for _, block := range payload.Content {
		if block.Type != "tool_use" || block.Name != "emit_knowledge_graph" {
			continue
		}
		var emitted EmittedDistillation
		if err := json.Unmarshal(block.Input, &emitted); err != nil {
			return EmittedDistillation{}, fmt.Errorf("parse knowledge graph tool input: %w", err)
		}
		normalizeDistillation(&emitted)
		return emitted, nil
	}
	return EmittedDistillation{}, fmt.Errorf("Anthropic response did not include emit_knowledge_graph tool use")
}

func renderCorpusText(sections []CorpusSection) string {
	parts := make([]string, 0, len(sections))
	for _, section := range sections {
		parts = append(parts, "id: "+section.ID+"\nurl: "+section.URL+"\ntitle: "+section.Title+"\n\n"+section.Text)
	}
	return strings.Join(parts, "\n\n---\n\n")
}

const kgSystemPrompt = "You build documentation knowledge graphs for an AI search agent. Return only the forced tool call. " +
	"Write a compact orientation, a glossary with aliases real users would type, one tight summary for every section id in the corpus, " +
	"and 3-5 natural questions a reader might ask that these docs answer. Summaries are what the agent reasons from, so make them faithful " +
	"and self-contained; paraphrase prose but never restate code, flags, or exact identifiers."

func knowledgeGraphTool() map[string]any {
	return map[string]any{
		"name":        "emit_knowledge_graph",
		"description": "Emit a documentation knowledge graph: a compact orientation, a glossary, and one distilled summary per section.",
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
