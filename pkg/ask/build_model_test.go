package ask

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildDigestSkipsCurrentGraphWithoutAPIKey(t *testing.T) {
	root := writeParityFixture(t)
	options := BuildOptions{SiteRoot: root, Collections: []string{"docs"}, BasePath: "/docs/", ChunkHeadingDepth: 3}
	corpus, err := BuildCorpus(options)
	if err != nil {
		t.Fatal(err)
	}
	digest := AssembleDigest(EmittedDistillation{Context: "ctx", Glossary: []GlossaryEntry{}, Summaries: []SectionSummaryIn{}}, corpus)
	if err := WriteDigest(filepath.Join(root, ".hev-ask/digest.json"), digest); err != nil {
		t.Fatal(err)
	}
	result, err := BuildDigest(BuildDigestOptions{BuildOptions: options})
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "skipped" || result.Chunks != len(corpus.Chunks) {
		t.Fatalf("unexpected result: %#v", result)
	}
}

func TestBuildDigestCallsAnthropicAndWritesGraph(t *testing.T) {
	root := writeParityFixture(t)
	options := BuildOptions{SiteRoot: root, Collections: []string{"docs"}, BasePath: "/docs/", ChunkHeadingDepth: 3}
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if request.Header.Get("x-api-key") != "test-key" {
			t.Fatalf("missing api key header")
		}
		if request.Header.Get("anthropic-version") != anthropicVersion {
			t.Fatalf("unexpected anthropic version")
		}
		var body map[string]any
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["model"] != "test-model" {
			t.Fatalf("unexpected model: %#v", body["model"])
		}
		encoded, _ := json.Marshal(body)
		if !strings.Contains(string(encoded), "api/config#options") {
			t.Fatalf("request did not include corpus: %s", encoded)
		}
		payload := map[string]any{
			"content": []map[string]any{
				{
					"type": "tool_use",
					"name": "emit_digest",
					"input": map[string]any{
						"context": "Fixture docs.",
						"glossary": []map[string]any{
							{"term": "ask", "aliases": []string{"cli"}, "definition": "A command."},
						},
						"summaries": []map[string]any{
							{"id": "api/config#options", "summary": "Configures the endpoint."},
							{"id": "index#install-ask", "summary": "Installs ask."},
						},
						"suggestions": []string{"How do I configure it?"},
					},
				},
			},
		}
		data, _ := json.Marshal(payload)
		return response(http.StatusOK, "application/json", data), nil
	})}
	result, err := BuildDigest(BuildDigestOptions{
		BuildOptions: options,
		DigestModel:  "test-model",
		APIKey:       "test-key",
		HTTPClient:   client,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "built" {
		t.Fatalf("unexpected result: %#v", result)
	}
	digest, err := LoadDigest(filepath.Join(root, ".hev-ask"))
	if err != nil {
		t.Fatal(err)
	}
	node, ok := GetSection(digest, "api/config#options")
	if !ok || node.Summary != "Configures the endpoint." {
		t.Fatalf("unexpected digest node: %#v %v", node, ok)
	}
}

func TestBuildDigestRequiresKeyForFreshGraph(t *testing.T) {
	root := writeParityFixture(t)
	t.Setenv("ANTHROPIC_API_KEY", "")
	_, err := BuildDigest(BuildDigestOptions{
		BuildOptions: BuildOptions{SiteRoot: root, Collections: []string{"docs"}, BasePath: "/docs/", ChunkHeadingDepth: 3},
	})
	if err == nil || !strings.Contains(err.Error(), "ANTHROPIC_API_KEY") {
		t.Fatalf("expected key error, got %v", err)
	}
}

func TestBuildDigestCallsOpenAICompatibleProvider(t *testing.T) {
	root := writeParityFixture(t)
	options := BuildOptions{SiteRoot: root, Collections: []string{"docs"}, BasePath: "/docs/", ChunkHeadingDepth: 3}
	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if got := request.URL.String(); got != "https://openrouter.ai/api/v1/chat/completions" {
			t.Fatalf("unexpected URL: %s", got)
		}
		if request.Header.Get("authorization") != "Bearer test-key" {
			t.Fatalf("missing bearer key header")
		}
		var body map[string]any
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if body["model"] != "anthropic/claude-opus-4.8" {
			t.Fatalf("unexpected model: %#v", body["model"])
		}
		if _, ok := body["max_tokens"]; !ok {
			t.Fatalf("OpenRouter request should use max_tokens: %#v", body)
		}
		choice, _ := body["tool_choice"].(map[string]any)
		if choice["type"] != "function" {
			t.Fatalf("unexpected tool_choice: %#v", body["tool_choice"])
		}
		encoded, _ := json.Marshal(body)
		if !strings.Contains(string(encoded), "api/config#options") {
			t.Fatalf("request did not include corpus: %s", encoded)
		}
		arguments, _ := json.Marshal(map[string]any{
			"context": "Fixture docs.",
			"glossary": []map[string]any{
				{"term": "ask", "aliases": []string{"cli"}, "definition": "A command."},
			},
			"summaries": []map[string]any{
				{"id": "api/config#options", "summary": "Configures the endpoint."},
				{"id": "index#install-ask", "summary": "Installs ask."},
			},
			"suggestions": []string{"How do I configure it?"},
		})
		payload := map[string]any{
			"choices": []map[string]any{
				{
					"finish_reason": "tool_calls",
					"message": map[string]any{
						"tool_calls": []map[string]any{
							{
								"id":   "call_1",
								"type": "function",
								"function": map[string]any{
									"name":      "emit_digest",
									"arguments": string(arguments),
								},
							},
						},
					},
				},
			},
		}
		data, _ := json.Marshal(payload)
		return response(http.StatusOK, "application/json", data), nil
	})}
	result, err := BuildDigest(BuildDigestOptions{
		BuildOptions: options,
		Provider:     "openrouter",
		APIKey:       "test-key",
		HTTPClient:   client,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "built" {
		t.Fatalf("unexpected result: %#v", result)
	}
	digest, err := LoadDigest(filepath.Join(root, ".hev-ask"))
	if err != nil {
		t.Fatal(err)
	}
	node, ok := GetSection(digest, "api/config#options")
	if !ok || node.Summary != "Configures the endpoint." {
		t.Fatalf("unexpected digest node: %#v %v", node, ok)
	}
}

func TestBuildDigestOpenAIUsesMaxCompletionTokensAndProviderKey(t *testing.T) {
	root := writeParityFixture(t)
	t.Setenv("OPENAI_API_KEY", "")
	_, err := BuildDigest(BuildDigestOptions{
		BuildOptions: BuildOptions{SiteRoot: root, Collections: []string{"docs"}, BasePath: "/docs/", ChunkHeadingDepth: 3},
		Provider:     "openai",
	})
	if err == nil || !strings.Contains(err.Error(), "OPENAI_API_KEY") {
		t.Fatalf("expected OPENAI_API_KEY error, got %v", err)
	}

	client := &http.Client{Transport: roundTripFunc(func(request *http.Request) (*http.Response, error) {
		if got := request.URL.String(); got != "https://example.com/v1/chat/completions" {
			t.Fatalf("unexpected URL: %s", got)
		}
		var body map[string]any
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if _, ok := body["max_completion_tokens"]; !ok {
			t.Fatalf("OpenAI request should use max_completion_tokens: %#v", body)
		}
		if _, ok := body["max_tokens"]; ok {
			t.Fatalf("OpenAI request should not send max_tokens")
		}
		data, _ := json.Marshal(map[string]any{
			"choices": []map[string]any{
				{
					"finish_reason": "tool_calls",
					"message": map[string]any{
						"tool_calls": []map[string]any{
							{"function": map[string]any{"name": "emit_digest", "arguments": `{"context":"x","glossary":[],"summaries":[],"suggestions":[]}`}},
						},
					},
				},
			},
		})
		return response(http.StatusOK, "application/json", data), nil
	})}
	_, err = BuildDigest(BuildDigestOptions{
		BuildOptions:    BuildOptions{SiteRoot: root, Collections: []string{"docs"}, BasePath: "/docs/", ChunkHeadingDepth: 3},
		Provider:        "openai",
		ProviderBaseURL: "https://example.com/v1/",
		APIKey:          "test-key",
		HTTPClient:      client,
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestBuildDigestRejectsUnknownProvider(t *testing.T) {
	root := writeParityFixture(t)
	_, err := BuildDigest(BuildDigestOptions{
		BuildOptions: BuildOptions{SiteRoot: root, Collections: []string{"docs"}, BasePath: "/docs/", ChunkHeadingDepth: 3},
		Provider:     "gemini",
	})
	if err == nil || !strings.Contains(err.Error(), "unknown provider") {
		t.Fatalf("expected unknown provider error, got %v", err)
	}
}
