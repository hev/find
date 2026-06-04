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

func TestServeMCPListsToolsAndCallsLocalReadTools(t *testing.T) {
	path := writeMCPTestGraph(t)
	input := strings.Join([]string{
		`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}`,
		`{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}`,
		`{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"search","arguments":{"query":"kg path","maxResults":1}}}`,
		`{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"glossary_get","arguments":{"term":"kg"}}}`,
	}, "\n") + "\n"

	var out bytes.Buffer
	if err := ServeMCP(context.Background(), MCPOptions{KGPath: path}, strings.NewReader(input), &out); err != nil {
		t.Fatal(err)
	}

	responses := decodeMCPTestResponses(t, out.String())
	if len(responses) != 4 {
		t.Fatalf("expected 4 responses, got %d: %s", len(responses), out.String())
	}

	var initialize struct {
		ProtocolVersion string `json:"protocolVersion"`
		ServerInfo      struct {
			Name string `json:"name"`
		} `json:"serverInfo"`
	}
	decodeMCPResult(t, responses[0], &initialize)
	if initialize.ProtocolVersion == "" || initialize.ServerInfo.Name != "hev-ask" {
		t.Fatalf("unexpected initialize result: %#v", initialize)
	}

	var tools struct {
		Tools []struct {
			Name string `json:"name"`
		} `json:"tools"`
	}
	decodeMCPResult(t, responses[1], &tools)
	if !mcpToolNamed(tools.Tools, "search") || !mcpToolNamed(tools.Tools, "answer") {
		t.Fatalf("expected search and answer tools, got %#v", tools.Tools)
	}

	var search struct {
		IsError           bool            `json:"isError"`
		StructuredContent KeywordResponse `json:"structuredContent"`
	}
	decodeMCPResult(t, responses[2], &search)
	if search.IsError || len(search.StructuredContent.Results) != 1 || search.StructuredContent.Results[0].URL != "/docs/api/cli#flags" {
		t.Fatalf("unexpected search result: %#v", search)
	}

	var glossary struct {
		IsError           bool          `json:"isError"`
		StructuredContent GlossaryEntry `json:"structuredContent"`
	}
	decodeMCPResult(t, responses[3], &glossary)
	if glossary.IsError || glossary.StructuredContent.Term != "Knowledge graph" {
		t.Fatalf("unexpected glossary result: %#v", glossary)
	}
}

func TestServeMCPAnswerWithoutEndpointReturnsToolError(t *testing.T) {
	path := writeMCPTestGraph(t)
	input := `{"jsonrpc":"2.0","id":"answer","method":"tools/call","params":{"name":"answer","arguments":{"query":"How does it work?"}}}` + "\n"

	var out bytes.Buffer
	if err := ServeMCP(context.Background(), MCPOptions{KGPath: path}, strings.NewReader(input), &out); err != nil {
		t.Fatal(err)
	}

	responses := decodeMCPTestResponses(t, out.String())
	if len(responses) != 1 {
		t.Fatalf("expected 1 response, got %d: %s", len(responses), out.String())
	}
	var result struct {
		IsError bool         `json:"isError"`
		Content []mcpContent `json:"content"`
	}
	decodeMCPResult(t, responses[0], &result)
	if !result.IsError || len(result.Content) != 1 || !strings.Contains(result.Content[0].Text, "requires --endpoint") {
		t.Fatalf("unexpected answer error result: %#v", result)
	}
}

func writeMCPTestGraph(t *testing.T) string {
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

type mcpTestRPCResponse struct {
	Result json.RawMessage  `json:"result"`
	Error  *rpcErrorPayload `json:"error"`
}

func decodeMCPTestResponses(t *testing.T, output string) []mcpTestRPCResponse {
	t.Helper()
	lines := strings.Split(strings.TrimSpace(output), "\n")
	responses := make([]mcpTestRPCResponse, 0, len(lines))
	for _, line := range lines {
		var response mcpTestRPCResponse
		if err := json.Unmarshal([]byte(line), &response); err != nil {
			t.Fatalf("decode response %q: %v", line, err)
		}
		if response.Error != nil {
			t.Fatalf("unexpected rpc error in %q: %#v", line, response.Error)
		}
		responses = append(responses, response)
	}
	return responses
}

func decodeMCPResult(t *testing.T, response mcpTestRPCResponse, out any) {
	t.Helper()
	if err := json.Unmarshal(response.Result, out); err != nil {
		t.Fatalf("decode result %s: %v", response.Result, err)
	}
}

func mcpToolNamed(tools []struct {
	Name string `json:"name"`
}, name string) bool {
	for _, tool := range tools {
		if tool.Name == name {
			return true
		}
	}
	return false
}
