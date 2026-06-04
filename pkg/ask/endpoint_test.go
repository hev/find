package ask

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

func TestEndpointClientReadRoutes(t *testing.T) {
	client := NewEndpointClient("https://docs.example/api/ask")
	client.HTTPClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		var body []byte
		status := http.StatusOK
		switch r.URL.RequestURI() {
		case "/api/ask/glossary/kg":
			body, _ = json.Marshal(GlossaryEntry{Term: "knowledge graph"})
		case "/api/ask/sections/api%2Fcli%23flags":
			body, _ = json.Marshal(KnowledgeNode{ID: "api/cli#flags", URL: "/docs/api/cli#flags"})
		case "/api/ask/sections?group=API":
			body, _ = json.Marshal(struct {
				Sections []SectionSummary `json:"sections"`
			}{Sections: []SectionSummary{{ID: "api/cli#flags", URL: "/docs/api/cli#flags"}}})
		default:
			status = http.StatusNotFound
			body = []byte(`{"error":"not found"}`)
		}
		return response(status, "application/json", body), nil
	})}

	entry, err := client.GetGlossaryEntry(context.Background(), "kg")
	if err != nil || entry.Term != "knowledge graph" {
		t.Fatalf("unexpected glossary response: %#v %v", entry, err)
	}
	node, err := client.GetSection(context.Background(), "api/cli#flags")
	if err != nil || node.ID != "api/cli#flags" {
		t.Fatalf("unexpected section response: %#v %v", node, err)
	}
	sections, err := client.ListSections(context.Background(), "API")
	if err != nil || len(sections) != 1 {
		t.Fatalf("unexpected sections response: %#v %v", sections, err)
	}
}

func TestEndpointClientStreamAnswer(t *testing.T) {
	client := NewEndpointClient("https://docs.example/api/ask")
	client.HTTPClient = &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path != "/api/ask" || r.Method != http.MethodPost {
			return response(http.StatusNotFound, "application/json", []byte(`{"error":"not found"}`)), nil
		}
		body := []byte("event: token\ndata: {\"text\":\"Hello \"}\n\n" +
			"event: token\ndata: {\"text\":\"world\"}\n\n" +
			"event: done\ndata: {}\n\n")
		return response(http.StatusOK, "text/event-stream", body), nil
	})}

	var events []string
	err := client.StreamAnswer(context.Background(), "hello", func(event AnswerEvent) error {
		events = append(events, event.Event)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if got := len(events); got != 3 {
		t.Fatalf("expected 3 events, got %d: %#v", got, events)
	}
}

func response(status int, contentType string, body []byte) *http.Response {
	return &http.Response{
		StatusCode: status,
		Status:     http.StatusText(status),
		Header:     http.Header{"Content-Type": []string{contentType}},
		Body:       io.NopCloser(bytes.NewReader(body)),
	}
}
