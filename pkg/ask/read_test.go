package ask

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func testGraph() KnowledgeGraph {
	apiGroup := "API"
	overviewGroup := "Overview"
	flagsHeading := "Flags"
	introHeading := "Introduction"
	return KnowledgeGraph{
		Version: 2,
		Context: "Docs orientation.",
		Glossary: []GlossaryEntry{
			{Term: "Knowledge graph", Aliases: []string{"kg", "shadow site"}, Definition: "Committed docs graph."},
		},
		Overview: "## API\n- Flags - `api/cli#flags`",
		Nodes: []KnowledgeNode{
			{
				ID:      "api/cli#flags",
				Kind:    "section",
				Title:   "CLI",
				Heading: &flagsHeading,
				Group:   &apiGroup,
				URL:     "/docs/api/cli#flags",
				Summary: "Command flags configure graph paths and output.",
				Facts:   []Fact{{Kind: "flag", Literal: "--kg-path", ChunkID: "api/cli#flags"}},
				Mode:    "source-primary",
				Terms:   []string{"flags", "graph", "paths"},
			},
			{
				ID:      "index#intro",
				Kind:    "section",
				Title:   "Intro",
				Heading: &introHeading,
				Group:   &overviewGroup,
				URL:     "/docs#intro",
				Summary: "The overlay and CLI read the same graph.",
				Mode:    "agent-primary",
				Terms:   []string{"overlay", "cli"},
			},
		},
	}
}

func TestLoadGraphNormalizesSlices(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "kg.json")
	if err := os.WriteFile(path, []byte(`{"version":2,"nodes":[{"id":"x","url":"/x"}]}`), 0o600); err != nil {
		t.Fatal(err)
	}
	graph, err := LoadGraph(path)
	if err != nil {
		t.Fatal(err)
	}
	if graph.Glossary == nil || graph.Nodes[0].Facts == nil || graph.Nodes[0].Terms == nil {
		t.Fatalf("expected nil slices to normalize to empty slices: %#v", graph)
	}
	if graph.Nodes[0].Kind != "section" {
		t.Fatalf("expected default node kind, got %q", graph.Nodes[0].Kind)
	}
}

func TestReadHelpers(t *testing.T) {
	graph := testGraph()
	if entry, ok := GetGlossaryEntry(graph, "KG"); !ok || entry.Term != "Knowledge graph" {
		t.Fatalf("expected alias lookup to resolve term, got %#v %v", entry, ok)
	}
	sections := ListSectionSummaries(graph, "api")
	if len(sections) != 1 || sections[0].ID != "api/cli#flags" {
		t.Fatalf("unexpected filtered sections: %#v", sections)
	}
	node, ok := GetSection(graph, "api%2Fcli%23flags")
	if !ok || node.URL != "/docs/api/cli#flags" {
		t.Fatalf("expected encoded section lookup to resolve, got %#v %v", node, ok)
	}
	overview := GetOverview(graph)
	if overview.Context != "Docs orientation." || overview.Overview == "" {
		t.Fatalf("unexpected overview: %#v", overview)
	}
}

func TestSearchGraphUsesGlossaryAndFacts(t *testing.T) {
	response := SearchGraph(testGraph(), "kg path", SearchOptions{MaxResults: 4})
	if len(response.Results) == 0 {
		t.Fatal("expected search results")
	}
	data, _ := json.Marshal(response.Results[0])
	if response.Results[0].URL != "/docs/api/cli#flags" {
		t.Fatalf("expected flags section first, got %s", data)
	}
}
