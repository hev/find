package ask

import (
	"os"
	"path/filepath"
	"testing"
)

func TestVerifyAnchorsChecksRenderedIDs(t *testing.T) {
	root := writeParityFixture(t)
	dist := filepath.Join(root, "dist/docs")
	if err := os.MkdirAll(dist, 0o755); err != nil {
		t.Fatal(err)
	}
	html := `<h2 id="install-ask">Install</h2><h3 id='install-ask-1'>Again</h3>`
	if err := os.WriteFile(filepath.Join(dist, "index.html"), []byte(html), 0o600); err != nil {
		t.Fatal(err)
	}
	configDist := filepath.Join(root, "dist/docs/api/config")
	if err := os.MkdirAll(configDist, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(configDist, "index.html"), []byte(`<h2 id="options">Options</h2>`), 0o600); err != nil {
		t.Fatal(err)
	}

	result, err := VerifyAnchors(VerifyOptions{
		BuildOptions: BuildOptions{SiteRoot: root, Collections: []string{"docs"}, BasePath: "/docs/", ChunkHeadingDepth: 3},
		SkipBuild:    true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.Checked != 4 {
		t.Fatalf("expected 4 anchored chunks, got %d", result.Checked)
	}
	if len(result.Missing) != 1 || result.Missing[0].AnchorID != "tables--lists" {
		t.Fatalf("expected missing tables anchor, got %#v", result.Missing)
	}
}

func TestVerifyAnchorsChecksCoverageAndLiteralFidelity(t *testing.T) {
	root := writeParityFixture(t)
	corpus, err := BuildCorpus(BuildOptions{SiteRoot: root, Collections: []string{"docs"}, BasePath: "/docs/", ChunkHeadingDepth: 3})
	if err != nil {
		t.Fatal(err)
	}
	graph := AssembleGraph(EmittedDistillation{
		Context:   "ctx",
		Glossary:  []GlossaryEntry{},
		Summaries: []SectionSummaryIn{},
	}, corpus)
	for i := range graph.Nodes {
		if graph.Nodes[i].ID == "index#install-ask" {
			graph.Nodes[i].Facts = []Fact{}
		}
	}
	graph.Nodes = graph.Nodes[:len(graph.Nodes)-1]
	if err := WriteGraph(filepath.Join(root, ".hev-ask/kg.json"), graph); err != nil {
		t.Fatal(err)
	}

	result, err := VerifyAnchors(VerifyOptions{
		BuildOptions: BuildOptions{SiteRoot: root, Collections: []string{"docs"}, BasePath: "/docs/", ChunkHeadingDepth: 3},
		SkipBuild:    true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Uncovered) != 1 || result.Uncovered[0] != "index#tables--lists" {
		t.Fatalf("unexpected uncovered sections: %#v", result.Uncovered)
	}
	if len(result.Dropped) == 0 {
		t.Fatal("expected dropped literals from agent-primary node")
	}
}
