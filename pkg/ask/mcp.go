package ask

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"
)

const mcpProtocolVersion = "2025-06-18"

type MCPOptions struct {
	KGPath     string
	Endpoint   string
	MaxResults int
}

type rpcRequest struct {
	JSONRPC string           `json:"jsonrpc"`
	ID      *json.RawMessage `json:"id,omitempty"`
	Method  string           `json:"method"`
	Params  json.RawMessage  `json:"params,omitempty"`
}

type rpcResponse struct {
	JSONRPC string           `json:"jsonrpc"`
	ID      json.RawMessage  `json:"id"`
	Result  any              `json:"result,omitempty"`
	Error   *rpcErrorPayload `json:"error,omitempty"`
}

type rpcErrorPayload struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type mcpContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type mcpToolResult struct {
	Content           []mcpContent `json:"content"`
	StructuredContent any          `json:"structuredContent,omitempty"`
	IsError           bool         `json:"isError,omitempty"`
}

type mcpServer struct {
	options MCPOptions
}

func ServeMCP(ctx context.Context, options MCPOptions, in io.Reader, out io.Writer) error {
	if options.KGPath == "" {
		options.KGPath = ".hev-ask/kg.json"
	}
	if options.MaxResults <= 0 {
		options.MaxResults = 8
	}

	server := mcpServer{options: options}
	scanner := bufio.NewScanner(in)
	scanner.Buffer(make([]byte, 0, 64*1024), 8*1024*1024)
	for scanner.Scan() {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		if err := server.handleLine(ctx, []byte(line), out); err != nil {
			return err
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	return ctx.Err()
}

func (server mcpServer) handleLine(ctx context.Context, line []byte, out io.Writer) error {
	var request rpcRequest
	if err := json.Unmarshal(line, &request); err != nil {
		return writeRPCError(out, nil, -32700, "parse error")
	}
	if request.Method == "" {
		if request.ID == nil {
			return nil
		}
		return writeRPCError(out, request.ID, -32600, "invalid request")
	}

	result, rpcErr := server.handleRequest(ctx, request)
	if request.ID == nil || strings.HasPrefix(request.Method, "notifications/") {
		return nil
	}
	if rpcErr != nil {
		return writeRPCError(out, request.ID, rpcErr.Code, rpcErr.Message)
	}
	return writeRPCResult(out, request.ID, result)
}

func (server mcpServer) handleRequest(ctx context.Context, request rpcRequest) (any, *rpcErrorPayload) {
	switch request.Method {
	case "initialize":
		return map[string]any{
			"protocolVersion": mcpProtocolVersion,
			"capabilities": map[string]any{
				"tools": map[string]any{},
			},
			"serverInfo": map[string]any{
				"name":    "hev-ask",
				"version": "0.0.1",
			},
		}, nil
	case "notifications/initialized":
		return nil, nil
	case "tools/list":
		return map[string]any{"tools": mcpTools()}, nil
	case "tools/call":
		var params struct {
			Name      string          `json:"name"`
			Arguments json.RawMessage `json:"arguments"`
		}
		if err := decodeObject(request.Params, &params); err != nil {
			return nil, &rpcErrorPayload{Code: -32602, Message: err.Error()}
		}
		if strings.TrimSpace(params.Name) == "" {
			return nil, &rpcErrorPayload{Code: -32602, Message: "tools/call requires a tool name"}
		}
		result, err := server.callTool(ctx, params.Name, params.Arguments)
		if err != nil {
			return mcpErrorResult(err), nil
		}
		return result, nil
	default:
		return nil, &rpcErrorPayload{Code: -32601, Message: "method not found"}
	}
}

func mcpTools() []map[string]any {
	return []map[string]any{
		{
			"name":        "glossary_list",
			"description": "List glossary terms and aliases from the hev ask knowledge graph.",
			"inputSchema": objectSchema(nil, nil),
		},
		{
			"name":        "glossary_get",
			"description": "Get one glossary entry by term or alias.",
			"inputSchema": objectSchema(map[string]any{
				"term": stringSchema("Term or alias to resolve."),
			}, []string{"term"}),
		},
		{
			"name":        "sections_list",
			"description": "List section summaries from the knowledge graph, optionally filtered by group.",
			"inputSchema": objectSchema(map[string]any{
				"group": stringSchema("Optional section group filter."),
			}, nil),
		},
		{
			"name":        "section_get",
			"description": "Get one knowledge graph section node by id.",
			"inputSchema": objectSchema(map[string]any{
				"id": stringSchema("Section id, such as api/cli#flags."),
			}, []string{"id"}),
		},
		{
			"name":        "overview",
			"description": "Return the documentation overview and orientation context.",
			"inputSchema": objectSchema(nil, nil),
		},
		{
			"name":        "search",
			"description": "Run local keyword search over the knowledge graph, or remote keyword search with --endpoint.",
			"inputSchema": objectSchema(map[string]any{
				"query":      stringSchema("Search query."),
				"maxResults": map[string]any{"type": "integer", "minimum": 1, "description": "Maximum local results."},
			}, []string{"query"}),
		},
		{
			"name":        "answer",
			"description": "Stream an agentic answer from a deployed /api/ask endpoint.",
			"inputSchema": objectSchema(map[string]any{
				"query": stringSchema("Question to answer."),
			}, []string{"query"}),
		},
	}
}

func objectSchema(properties map[string]any, required []string) map[string]any {
	if properties == nil {
		properties = map[string]any{}
	}
	schema := map[string]any{
		"type":                 "object",
		"properties":           properties,
		"additionalProperties": false,
	}
	if len(required) > 0 {
		schema["required"] = required
	}
	return schema
}

func stringSchema(description string) map[string]any {
	return map[string]any{"type": "string", "description": description}
}

func (server mcpServer) callTool(ctx context.Context, name string, arguments json.RawMessage) (mcpToolResult, error) {
	switch name {
	case "glossary_list":
		var args struct{}
		if err := decodeObject(arguments, &args); err != nil {
			return mcpToolResult{}, err
		}
		terms, err := server.listGlossary(ctx)
		if err != nil {
			return mcpToolResult{}, err
		}
		payload := map[string]any{"terms": terms}
		return mcpStructuredResult(payload, formatJSON(payload)), nil
	case "glossary_get":
		var args struct {
			Term string `json:"term"`
		}
		if err := decodeObject(arguments, &args); err != nil {
			return mcpToolResult{}, err
		}
		if strings.TrimSpace(args.Term) == "" {
			return mcpToolResult{}, errors.New("glossary_get requires term")
		}
		entry, err := server.getGlossaryEntry(ctx, args.Term)
		if err != nil {
			return mcpToolResult{}, err
		}
		return mcpStructuredResult(entry, formatJSON(entry)), nil
	case "sections_list":
		var args struct {
			Group string `json:"group"`
		}
		if err := decodeObject(arguments, &args); err != nil {
			return mcpToolResult{}, err
		}
		sections, err := server.listSections(ctx, args.Group)
		if err != nil {
			return mcpToolResult{}, err
		}
		payload := map[string]any{"sections": sections}
		return mcpStructuredResult(payload, formatJSON(payload)), nil
	case "section_get":
		var args struct {
			ID string `json:"id"`
		}
		if err := decodeObject(arguments, &args); err != nil {
			return mcpToolResult{}, err
		}
		if strings.TrimSpace(args.ID) == "" {
			return mcpToolResult{}, errors.New("section_get requires id")
		}
		node, err := server.getSection(ctx, args.ID)
		if err != nil {
			return mcpToolResult{}, err
		}
		return mcpStructuredResult(node, formatJSON(node)), nil
	case "overview":
		var args struct{}
		if err := decodeObject(arguments, &args); err != nil {
			return mcpToolResult{}, err
		}
		overview, err := server.overview(ctx)
		if err != nil {
			return mcpToolResult{}, err
		}
		return mcpStructuredResult(overview, formatJSON(overview)), nil
	case "search":
		var args struct {
			Query      string `json:"query"`
			MaxResults int    `json:"maxResults"`
		}
		if err := decodeObject(arguments, &args); err != nil {
			return mcpToolResult{}, err
		}
		if strings.TrimSpace(args.Query) == "" {
			return mcpToolResult{}, errors.New("search requires query")
		}
		response, err := server.search(ctx, args.Query, args.MaxResults)
		if err != nil {
			return mcpToolResult{}, err
		}
		return mcpStructuredResult(response, formatJSON(response)), nil
	case "answer":
		var args struct {
			Query string `json:"query"`
		}
		if err := decodeObject(arguments, &args); err != nil {
			return mcpToolResult{}, err
		}
		if strings.TrimSpace(args.Query) == "" {
			return mcpToolResult{}, errors.New("answer requires query")
		}
		payload, text, err := server.answer(ctx, args.Query)
		if err != nil {
			return mcpToolResult{}, err
		}
		return mcpStructuredResult(payload, text), nil
	default:
		return mcpToolResult{}, fmt.Errorf("unknown tool %q", name)
	}
}

func (server mcpServer) listGlossary(ctx context.Context) ([]GlossaryEntry, error) {
	if server.options.Endpoint != "" {
		return NewEndpointClient(server.options.Endpoint).ListGlossary(ctx)
	}
	graph, err := LoadGraph(server.options.KGPath)
	if err != nil {
		return nil, err
	}
	return ListGlossary(graph), nil
}

func (server mcpServer) getGlossaryEntry(ctx context.Context, term string) (GlossaryEntry, error) {
	if server.options.Endpoint != "" {
		return NewEndpointClient(server.options.Endpoint).GetGlossaryEntry(ctx, term)
	}
	graph, err := LoadGraph(server.options.KGPath)
	if err != nil {
		return GlossaryEntry{}, err
	}
	entry, ok := GetGlossaryEntry(graph, term)
	if !ok {
		return GlossaryEntry{}, fmt.Errorf("no glossary entry matched %q", term)
	}
	return entry, nil
}

func (server mcpServer) listSections(ctx context.Context, group string) ([]SectionSummary, error) {
	if server.options.Endpoint != "" {
		return NewEndpointClient(server.options.Endpoint).ListSections(ctx, group)
	}
	graph, err := LoadGraph(server.options.KGPath)
	if err != nil {
		return nil, err
	}
	return ListSectionSummaries(graph, group), nil
}

func (server mcpServer) getSection(ctx context.Context, id string) (KnowledgeNode, error) {
	if server.options.Endpoint != "" {
		return NewEndpointClient(server.options.Endpoint).GetSection(ctx, id)
	}
	graph, err := LoadGraph(server.options.KGPath)
	if err != nil {
		return KnowledgeNode{}, err
	}
	node, ok := GetSection(graph, id)
	if !ok {
		return KnowledgeNode{}, fmt.Errorf("no section matched %q", id)
	}
	return node, nil
}

func (server mcpServer) overview(ctx context.Context) (Overview, error) {
	if server.options.Endpoint != "" {
		return NewEndpointClient(server.options.Endpoint).Overview(ctx)
	}
	graph, err := LoadGraph(server.options.KGPath)
	if err != nil {
		return Overview{}, err
	}
	return GetOverview(graph), nil
}

func (server mcpServer) search(ctx context.Context, query string, maxResults int) (KeywordResponse, error) {
	if server.options.Endpoint != "" {
		return NewEndpointClient(server.options.Endpoint).Search(ctx, query)
	}
	graph, err := LoadGraph(server.options.KGPath)
	if err != nil {
		return KeywordResponse{}, err
	}
	if maxResults <= 0 {
		maxResults = server.options.MaxResults
	}
	return SearchGraph(graph, query, SearchOptions{MaxResults: maxResults}), nil
}

func (server mcpServer) answer(ctx context.Context, query string) (any, string, error) {
	if server.options.Endpoint == "" {
		return nil, "", errors.New("answer requires --endpoint for the remote SSE answer path; without --endpoint, use search for keyless local retrieval")
	}

	var text strings.Builder
	var fallback *KeywordResponse
	err := NewEndpointClient(server.options.Endpoint).StreamAnswer(ctx, query, func(event AnswerEvent) error {
		switch event.Event {
		case "token":
			var payload struct {
				Text string `json:"text"`
			}
			if err := json.Unmarshal(event.Data, &payload); err != nil {
				return err
			}
			text.WriteString(payload.Text)
		case "keyword":
			var response KeywordResponse
			if err := json.Unmarshal(event.Data, &response); err != nil {
				return err
			}
			fallback = &response
		}
		return nil
	})
	if err != nil {
		return nil, "", err
	}
	if fallback != nil {
		payload := map[string]any{"fallback": fallback}
		return payload, formatJSON(payload), nil
	}
	answer := strings.TrimSpace(text.String())
	payload := map[string]any{"answer": answer}
	return payload, answer, nil
}

func decodeObject(raw json.RawMessage, out any) error {
	trimmed := strings.TrimSpace(string(raw))
	if trimmed == "" || trimmed == "null" {
		trimmed = "{}"
	}
	if !strings.HasPrefix(trimmed, "{") {
		return errors.New("expected object parameters")
	}
	decoder := json.NewDecoder(strings.NewReader(trimmed))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(out); err != nil {
		return err
	}
	return nil
}

func mcpStructuredResult(structured any, text string) mcpToolResult {
	return mcpToolResult{
		Content:           []mcpContent{{Type: "text", Text: text}},
		StructuredContent: structured,
	}
}

func mcpErrorResult(err error) mcpToolResult {
	return mcpToolResult{
		Content: []mcpContent{{
			Type: "text",
			Text: err.Error(),
		}},
		IsError: true,
	}
}

func formatJSON(value any) string {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Sprint(value)
	}
	return string(data)
}

func writeRPCResult(out io.Writer, id *json.RawMessage, result any) error {
	return writeRPCResponse(out, rpcResponse{JSONRPC: "2.0", ID: rawID(id), Result: result})
}

func writeRPCError(out io.Writer, id *json.RawMessage, code int, message string) error {
	return writeRPCResponse(out, rpcResponse{
		JSONRPC: "2.0",
		ID:      rawID(id),
		Error:   &rpcErrorPayload{Code: code, Message: message},
	})
}

func writeRPCResponse(out io.Writer, response rpcResponse) error {
	data, err := json.Marshal(response)
	if err != nil {
		return err
	}
	if _, err := out.Write(append(data, '\n')); err != nil {
		return err
	}
	return nil
}

func rawID(id *json.RawMessage) json.RawMessage {
	if id == nil || len(*id) == 0 {
		return json.RawMessage("null")
	}
	return *id
}
