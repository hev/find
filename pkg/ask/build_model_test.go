package ask

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"strings"
	"testing"
)

func TestBuildKnowledgeGraphSkipsCurrentGraphWithoutAPIKey(t *testing.T) {
	root := writeParityFixture(t)
	options := BuildOptions{SiteRoot: root, Collections: []string{"docs"}, BasePath: "/docs/", ChunkHeadingDepth: 3}
	corpus, err := BuildCorpus(options)
	if err != nil {
		t.Fatal(err)
	}
	graph := AssembleGraph(EmittedDistillation{Context: "ctx", Glossary: []GlossaryEntry{}, Summaries: []SectionSummaryIn{}}, corpus)
	if err := WriteGraph(filepath.Join(root, ".hev-ask/kg.json"), graph); err != nil {
		t.Fatal(err)
	}
	result, err := BuildKnowledgeGraph(BuildKnowledgeGraphOptions{BuildOptions: options})
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "skipped" || result.Chunks != len(corpus.Chunks) {
		t.Fatalf("unexpected result: %#v", result)
	}
}

func TestBuildKnowledgeGraphCallsAnthropicAndWritesGraph(t *testing.T) {
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
					"name": "emit_knowledge_graph",
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
	result, err := BuildKnowledgeGraph(BuildKnowledgeGraphOptions{
		BuildOptions: options,
		KGModel:      "test-model",
		APIKey:       "test-key",
		HTTPClient:   client,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "built" {
		t.Fatalf("unexpected result: %#v", result)
	}
	graph, err := LoadGraph(filepath.Join(root, ".hev-ask/kg.json"))
	if err != nil {
		t.Fatal(err)
	}
	node, ok := GetSection(graph, "api/config#options")
	if !ok || node.Summary != "Configures the endpoint." {
		t.Fatalf("unexpected graph node: %#v %v", node, ok)
	}
}

func TestBuildKnowledgeGraphRequiresKeyForFreshGraph(t *testing.T) {
	root := writeParityFixture(t)
	t.Setenv("ANTHROPIC_API_KEY", "")
	_, err := BuildKnowledgeGraph(BuildKnowledgeGraphOptions{
		BuildOptions: BuildOptions{SiteRoot: root, Collections: []string{"docs"}, BasePath: "/docs/", ChunkHeadingDepth: 3},
	})
	if err == nil || !strings.Contains(err.Error(), "ANTHROPIC_API_KEY") {
		t.Fatalf("expected key error, got %v", err)
	}
}
