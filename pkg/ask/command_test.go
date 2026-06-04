package ask

import (
	"bytes"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCommandGroupRunSearchJSON(t *testing.T) {
	path := writeCommandTestGraph(t)
	group := NewCommandGroup(CommandOptions{})

	var stdout, stderr bytes.Buffer
	err := group.Run(context.Background(), []string{"--kg-path", path, "--json", "--max-results", "1", "search", "kg", "path"}, strings.NewReader(""), &stdout, &stderr)
	if err != nil {
		t.Fatalf("run failed: %v\nstderr: %s", err, stderr.String())
	}

	var response KeywordResponse
	if err := json.Unmarshal(stdout.Bytes(), &response); err != nil {
		t.Fatalf("decode output %s: %v", stdout.String(), err)
	}
	if len(response.Results) != 1 || response.Results[0].URL != "/docs/api/cli#flags" {
		t.Fatalf("unexpected search output: %#v", response)
	}
}

func TestCommandGroupRunGlossaryAlias(t *testing.T) {
	path := writeCommandTestGraph(t)
	group := NewCommandGroup(CommandOptions{KGPath: path, JSONOutput: true})

	var stdout, stderr bytes.Buffer
	err := group.Run(context.Background(), []string{"glossary", "get", "kg"}, strings.NewReader(""), &stdout, &stderr)
	if err != nil {
		t.Fatalf("run failed: %v\nstderr: %s", err, stderr.String())
	}
	if !strings.Contains(stdout.String(), `"term": "Knowledge graph"`) {
		t.Fatalf("unexpected glossary output: %s", stdout.String())
	}
}

func writeCommandTestGraph(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "kg.json")
	data, err := json.Marshal(testGraph())
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}
