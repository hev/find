package ask

import (
	"encoding/json"
	"fmt"
	"os"
)

func LoadGraph(path string) (KnowledgeGraph, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return KnowledgeGraph{}, fmt.Errorf("read knowledge graph %q: %w", path, err)
	}
	var graph KnowledgeGraph
	if err := json.Unmarshal(data, &graph); err != nil {
		return KnowledgeGraph{}, fmt.Errorf("parse knowledge graph %q: %w", path, err)
	}
	normalizeGraph(&graph)
	return graph, nil
}

func normalizeGraph(graph *KnowledgeGraph) {
	if graph.Glossary == nil {
		graph.Glossary = []GlossaryEntry{}
	}
	if graph.Suggestions == nil {
		graph.Suggestions = []string{}
	}
	if graph.Nodes == nil {
		graph.Nodes = []KnowledgeNode{}
	}
	if graph.Edges == nil {
		graph.Edges = []KnowledgeEdge{}
	}
	for i := range graph.Glossary {
		if graph.Glossary[i].Aliases == nil {
			graph.Glossary[i].Aliases = []string{}
		}
	}
	for i := range graph.Nodes {
		node := &graph.Nodes[i]
		if node.Kind == "" {
			node.Kind = "section"
		}
		if node.Facts == nil {
			node.Facts = []Fact{}
		}
		if node.Sources == nil {
			node.Sources = []SourceRef{}
		}
		if node.Terms == nil {
			node.Terms = []string{}
		}
		if node.Mode == "" {
			node.Mode = "agent-primary"
		}
	}
}
