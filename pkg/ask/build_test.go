package ask

import (
	"os"
	"path/filepath"
	"testing"
)

func writeParityFixture(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	mustWrite := func(path string, body string) {
		t.Helper()
		full := filepath.Join(root, path)
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(body), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	mustWrite("src/content/docs/index.mdx", "---\n"+
		"title: \"Intro\"\n"+
		"description: \"Start here.\"\n"+
		"group: \"Overview\"\n"+
		"---\n"+
		"import X from \"./x\";\n\n"+
		"# Page Title\n\n"+
		"Intro with [a link](/x), `code`, and <Badge />.\n\n"+
		"## Install `ask`!\n\n"+
		"Use `ask search` and `--kg-path`.\n\n"+
		"### Install `ask`! ###\n\n"+
		"Duplicate heading with v1.2.3 and `claude-haiku-4-5`.\n\n"+
		"#### Too Deep\n\n"+
		"Stays in previous section.\n\n"+
		"## Tables & Lists\n\n"+
		"| Flag | Meaning |\n"+
		"|---|---|\n"+
		"| `--json` | machine output |\n\n"+
		"- item with _emphasis_\n")
	mustWrite("src/content/docs/api/config.mdx", "---\n"+
		"title: \"Config\"\n"+
		"description: \"API details.\"\n"+
		"group: \"API\"\n"+
		"---\n\n"+
		"## Options\n\n"+
		"Set `endpoint` to `/api/ask`.\n")
	return root
}

func TestBuildCorpusMatchesTypeScriptFixture(t *testing.T) {
	root := writeParityFixture(t)
	corpus, err := BuildCorpus(BuildOptions{SiteRoot: root, Collections: []string{"docs"}, BasePath: "/docs/", ChunkHeadingDepth: 3})
	if err != nil {
		t.Fatal(err)
	}
	if corpus.ContentHash != "9acd99f065a22fbb9e1dd186a162ef9b7cc441c24f42393db1ad5ab0fae91a51" {
		t.Fatalf("unexpected content hash: %s", corpus.ContentHash)
	}
	gotIDs := make([]string, len(corpus.Chunks))
	for i, chunk := range corpus.Chunks {
		gotIDs[i] = chunk.ID
	}
	wantIDs := []string{
		"api/config",
		"api/config#options",
		"index",
		"index#install-ask",
		"index#install-ask-1",
		"index#tables--lists",
	}
	for i, want := range wantIDs {
		if gotIDs[i] != want {
			t.Fatalf("chunk ids mismatch at %d: got %#v want %#v", i, gotIDs, wantIDs)
		}
	}
	wantText := "Install ask! ### Duplicate heading with v1.2.3 and claude-haiku-4-5. Too Deep Stays in previous section."
	if corpus.Chunks[4].Text != wantText {
		t.Fatalf("unexpected cleaned text:\n%s", corpus.Chunks[4].Text)
	}
}

func TestAssembleGraphDerivesNodesFactsAndOverview(t *testing.T) {
	root := writeParityFixture(t)
	corpus, err := BuildCorpus(BuildOptions{SiteRoot: root, Collections: []string{"docs"}, BasePath: "/docs/", ChunkHeadingDepth: 3})
	if err != nil {
		t.Fatal(err)
	}
	graph := AssembleGraph(EmittedDistillation{
		Context: "Fixture docs.",
		Glossary: []GlossaryEntry{
			{Term: "ask CLI", Aliases: []string{"ask"}, Definition: "Reads docs."},
		},
		Summaries: []SectionSummaryIn{{ID: "api/config#options", Summary: "Options configure the endpoint."}},
		Suggestions: []string{
			"How do I configure the endpoint?",
		},
	}, corpus)
	if graph.ContentHash != corpus.ContentHash || len(graph.Nodes) != len(corpus.Chunks) {
		t.Fatalf("unexpected graph shape: %#v", graph)
	}
	node, ok := GetSection(graph, "api/config#options")
	if !ok {
		t.Fatal("missing api/config#options node")
	}
	if node.Mode != "source-primary" {
		t.Fatalf("API node should be source-primary, got %q", node.Mode)
	}
	if len(node.Facts) != 2 || node.Facts[0].Literal != "endpoint" || node.Facts[1].Literal != "/api/ask" {
		t.Fatalf("unexpected facts: %#v", node.Facts)
	}
	if graph.Overview == "" || graph.Suggestions[0] == "" {
		t.Fatalf("expected overview and suggestions: %#v", graph)
	}
}
