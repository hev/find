package main

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	askpkg "github.com/hev/ask/pkg/ask"
)

func writeTestKG(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "kg.json")
	apiGroup := "API"
	flagsHeading := "Flags"
	graph := askpkg.KnowledgeGraph{
		Version: 2,
		Context: "Docs orientation.",
		Glossary: []askpkg.GlossaryEntry{
			{Term: "Knowledge graph", Aliases: []string{"kg"}, Definition: "Committed docs graph."},
		},
		Overview: "## API\n- Flags - `api/cli#flags`",
		Nodes: []askpkg.KnowledgeNode{
			{
				ID:      "api/cli#flags",
				Kind:    "section",
				Title:   "CLI",
				Heading: &flagsHeading,
				Group:   &apiGroup,
				URL:     "/docs/api/cli#flags",
				Summary: "Command flags configure graph paths.",
				Facts:   []askpkg.Fact{{Kind: "flag", Literal: "--kg-path", ChunkID: "api/cli#flags"}},
				Mode:    "source-primary",
				Terms:   []string{"flags", "graph"},
			},
		},
	}
	data, err := json.Marshal(graph)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestRunGlossaryGetJSON(t *testing.T) {
	path := writeTestKG(t)
	var stdout, stderr bytes.Buffer
	err := run(context.Background(), []string{"--kg-path", path, "--json", "glossary", "get", "kg"}, &stdout, &stderr)
	if err != nil {
		t.Fatalf("run failed: %v\nstderr: %s", err, stderr.String())
	}
	if !strings.Contains(stdout.String(), `"term": "Knowledge graph"`) {
		t.Fatalf("unexpected output: %s", stdout.String())
	}
}

func TestRunSectionsListGroupJSON(t *testing.T) {
	path := writeTestKG(t)
	var stdout, stderr bytes.Buffer
	err := run(context.Background(), []string{"--kg-path", path, "--json", "sections", "list", "--group", "api"}, &stdout, &stderr)
	if err != nil {
		t.Fatalf("run failed: %v\nstderr: %s", err, stderr.String())
	}
	if !strings.Contains(stdout.String(), `"id": "api/cli#flags"`) {
		t.Fatalf("unexpected output: %s", stdout.String())
	}
}

func TestRunSearchJSON(t *testing.T) {
	path := writeTestKG(t)
	var stdout, stderr bytes.Buffer
	err := run(context.Background(), []string{"--kg-path", path, "--json", "search", "kg", "path"}, &stdout, &stderr)
	if err != nil {
		t.Fatalf("run failed: %v\nstderr: %s", err, stderr.String())
	}
	if !strings.Contains(stdout.String(), `"url": "/docs/api/cli#flags"`) {
		t.Fatalf("unexpected output: %s", stdout.String())
	}
}

func TestRunKGCorpusAndAssemble(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "src/content/docs"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "src/content/docs/index.mdx"), []byte("---\ntitle: \"Intro\"\ndescription: \"Start.\"\ngroup: \"Overview\"\n---\n\n## Install\n\nUse `ask`.\n"), 0o600); err != nil {
		t.Fatal(err)
	}

	original, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := os.Chdir(original); err != nil {
			t.Fatal(err)
		}
	}()

	var stdout, stderr bytes.Buffer
	if err := run(context.Background(), []string{"kg", "corpus"}, &stdout, &stderr); err != nil {
		t.Fatalf("corpus failed: %v\nstderr: %s", err, stderr.String())
	}
	input, err := os.ReadFile(filepath.Join(dir, ".hev-ask/kg-input.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(input), `"id": "index#install"`) {
		t.Fatalf("unexpected corpus: %s", input)
	}

	distill := `{"context":"ctx","glossary":[],"summaries":[{"id":"index#install","summary":"Install ask."}],"suggestions":["How do I install?"]}`
	if err := os.WriteFile(filepath.Join(dir, ".hev-ask/kg-distill.json"), []byte(distill), 0o600); err != nil {
		t.Fatal(err)
	}
	stdout.Reset()
	if err := run(context.Background(), []string{"kg", "assemble"}, &stdout, &stderr); err != nil {
		t.Fatalf("assemble failed: %v\nstderr: %s", err, stderr.String())
	}
	graph, err := askpkg.LoadGraph(filepath.Join(dir, ".hev-ask/kg.json"))
	if err != nil {
		t.Fatal(err)
	}
	if len(graph.Nodes) != 2 || graph.Nodes[1].Summary != "Install ask." {
		t.Fatalf("unexpected graph: %#v", graph)
	}
}

func TestRunKGVerifySkipBuild(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "src/content/docs"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "src/content/docs/index.mdx"), []byte("---\ntitle: \"Intro\"\ndescription: \"Start.\"\ngroup: \"Overview\"\n---\n\n## Install\n\nUse `ask`.\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "dist/docs"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "dist/docs/index.html"), []byte(`<h2 id="install">Install</h2>`), 0o600); err != nil {
		t.Fatal(err)
	}
	graph := askpkg.AssembleGraph(askpkg.EmittedDistillation{
		Context:   "ctx",
		Glossary:  []askpkg.GlossaryEntry{},
		Summaries: []askpkg.SectionSummaryIn{{ID: "index#install", Summary: "Install ask."}},
	}, mustCorpus(t, dir))
	if err := askpkg.WriteGraph(filepath.Join(dir, ".hev-ask/kg.json"), graph); err != nil {
		t.Fatal(err)
	}

	original, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := os.Chdir(original); err != nil {
			t.Fatal(err)
		}
	}()

	var stdout, stderr bytes.Buffer
	if err := run(context.Background(), []string{"kg", "verify", "--skip-build"}, &stdout, &stderr); err != nil {
		t.Fatalf("verify failed: %v\nstdout: %s\nstderr: %s", err, stdout.String(), stderr.String())
	}
	if !strings.Contains(stdout.String(), "verified 1 anchors") {
		t.Fatalf("unexpected verify output: %s", stdout.String())
	}
}

func TestRunKGBuildSkipsCurrentGraph(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "src/content/docs"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "src/content/docs/index.mdx"), []byte("---\ntitle: \"Intro\"\ndescription: \"Start.\"\ngroup: \"Overview\"\n---\n\n## Install\n\nUse `ask`.\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	corpus := mustCorpus(t, dir)
	graph := askpkg.AssembleGraph(askpkg.EmittedDistillation{Context: "ctx", Glossary: []askpkg.GlossaryEntry{}}, corpus)
	if err := askpkg.WriteGraph(filepath.Join(dir, ".hev-ask/kg.json"), graph); err != nil {
		t.Fatal(err)
	}

	original, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	defer func() {
		if err := os.Chdir(original); err != nil {
			t.Fatal(err)
		}
	}()

	var stdout, stderr bytes.Buffer
	if err := run(context.Background(), []string{"kg", "build"}, &stdout, &stderr); err != nil {
		t.Fatalf("build failed: %v\nstdout: %s\nstderr: %s", err, stdout.String(), stderr.String())
	}
	if !strings.Contains(stdout.String(), "kg:skipped") {
		t.Fatalf("unexpected build output: %s", stdout.String())
	}
}

func mustCorpus(t *testing.T, root string) askpkg.CorpusBuild {
	t.Helper()
	corpus, err := askpkg.BuildCorpus(askpkg.BuildOptions{SiteRoot: root, Collections: []string{"docs"}, BasePath: "/docs/", ChunkHeadingDepth: 3})
	if err != nil {
		t.Fatal(err)
	}
	return corpus
}
