package ask

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

type EndpointClient struct {
	Endpoint   string
	HTTPClient *http.Client
}

type AnswerEvent struct {
	Event string          `json:"event"`
	Data  json.RawMessage `json:"data"`
}

func NewEndpointClient(endpoint string) EndpointClient {
	return EndpointClient{Endpoint: strings.TrimRight(endpoint, "/"), HTTPClient: http.DefaultClient}
}

func (client EndpointClient) ListGlossary(ctx context.Context) ([]GlossaryEntry, error) {
	var payload struct {
		Terms []GlossaryEntry `json:"terms"`
	}
	if err := client.getJSON(ctx, "glossary", &payload); err != nil {
		return nil, err
	}
	return payload.Terms, nil
}

func (client EndpointClient) GetGlossaryEntry(ctx context.Context, term string) (GlossaryEntry, error) {
	var entry GlossaryEntry
	if err := client.getJSON(ctx, "glossary/"+url.PathEscape(term), &entry); err != nil {
		return GlossaryEntry{}, err
	}
	return entry, nil
}

func (client EndpointClient) ListSections(ctx context.Context, group string) ([]SectionSummary, error) {
	path := "sections"
	if strings.TrimSpace(group) != "" {
		values := url.Values{}
		values.Set("group", group)
		path += "?" + values.Encode()
	}
	var payload struct {
		Sections []SectionSummary `json:"sections"`
	}
	if err := client.getJSON(ctx, path, &payload); err != nil {
		return nil, err
	}
	return payload.Sections, nil
}

func (client EndpointClient) GetSection(ctx context.Context, id string) (KnowledgeNode, error) {
	var node KnowledgeNode
	if err := client.getJSON(ctx, "sections/"+url.PathEscape(id), &node); err != nil {
		return KnowledgeNode{}, err
	}
	return node, nil
}

func (client EndpointClient) Overview(ctx context.Context) (Overview, error) {
	var overview Overview
	if err := client.getJSON(ctx, "overview", &overview); err != nil {
		return Overview{}, err
	}
	return overview, nil
}

func (client EndpointClient) Search(ctx context.Context, query string) (KeywordResponse, error) {
	var response KeywordResponse
	if err := client.postAskJSON(ctx, query, "keyword", &response); err != nil {
		return KeywordResponse{}, err
	}
	return response, nil
}

func (client EndpointClient) StreamAnswer(ctx context.Context, query string, handle func(AnswerEvent) error) error {
	response, err := client.postAsk(ctx, query, "agentic")
	if err != nil {
		return err
	}
	defer response.Body.Close()

	contentType := response.Header.Get("content-type")
	if strings.HasPrefix(contentType, "application/json") {
		var fallback KeywordResponse
		if err := json.NewDecoder(response.Body).Decode(&fallback); err != nil {
			return fmt.Errorf("decode keyword fallback: %w", err)
		}
		data, err := json.Marshal(fallback)
		if err != nil {
			return err
		}
		return handle(AnswerEvent{Event: "keyword", Data: data})
	}
	if !strings.HasPrefix(contentType, "text/event-stream") {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return fmt.Errorf("unexpected answer content-type %q: %s", contentType, strings.TrimSpace(string(body)))
	}

	return readSSE(response.Body, handle)
}

func (client EndpointClient) getJSON(ctx context.Context, resource string, out any) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, client.resourceURL(resource), nil)
	if err != nil {
		return err
	}
	response, err := client.http().Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	return decodeJSONResponse(response, out)
}

func (client EndpointClient) postAskJSON(ctx context.Context, query string, mode string, out any) error {
	response, err := client.postAsk(ctx, query, mode)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	return decodeJSONResponse(response, out)
}

func (client EndpointClient) postAsk(ctx context.Context, query string, mode string) (*http.Response, error) {
	body, err := json.Marshal(map[string]string{"query": query, "mode": mode})
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, client.resourceURL(""), bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("content-type", "application/json")
	response, err := client.http().Do(request)
	if err != nil {
		return nil, err
	}
	if response.StatusCode >= 400 {
		defer response.Body.Close()
		return nil, endpointStatusError(response)
	}
	return response, nil
}

func (client EndpointClient) resourceURL(resource string) string {
	if resource == "" {
		return client.Endpoint
	}
	return client.Endpoint + "/" + strings.TrimLeft(resource, "/")
}

func (client EndpointClient) http() *http.Client {
	if client.HTTPClient != nil {
		return client.HTTPClient
	}
	return http.DefaultClient
}

func decodeJSONResponse(response *http.Response, out any) error {
	if response.StatusCode >= 400 {
		return endpointStatusError(response)
	}
	if err := json.NewDecoder(response.Body).Decode(out); err != nil {
		return fmt.Errorf("decode endpoint JSON: %w", err)
	}
	return nil
}

func endpointStatusError(response *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
	var payload struct {
		Error string `json:"error"`
	}
	if json.Unmarshal(body, &payload) == nil && payload.Error != "" {
		return fmt.Errorf("endpoint %s: %s", response.Status, payload.Error)
	}
	return fmt.Errorf("endpoint %s: %s", response.Status, strings.TrimSpace(string(body)))
}

func readSSE(reader io.Reader, handle func(AnswerEvent) error) error {
	scanner := bufio.NewScanner(reader)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	event := "message"
	var data strings.Builder

	flush := func() error {
		if data.Len() == 0 {
			event = "message"
			return nil
		}
		payload := strings.TrimSuffix(data.String(), "\n")
		ev := AnswerEvent{Event: event, Data: json.RawMessage(payload)}
		event = "message"
		data.Reset()
		if ev.Event == "error" {
			var body struct {
				Error string `json:"error"`
			}
			if json.Unmarshal(ev.Data, &body) == nil && body.Error != "" {
				return fmt.Errorf("answer stream: %s", body.Error)
			}
		}
		return handle(ev)
	}

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			if err := flush(); err != nil {
				return err
			}
			continue
		}
		if strings.HasPrefix(line, "event:") {
			event = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
		} else if strings.HasPrefix(line, "data:") {
			data.WriteString(strings.TrimSpace(strings.TrimPrefix(line, "data:")))
			data.WriteByte('\n')
		}
	}
	if err := scanner.Err(); err != nil {
		return err
	}
	return flush()
}
