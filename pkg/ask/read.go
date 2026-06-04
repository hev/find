package ask

import (
	"net/url"
	"strings"
)

type Overview struct {
	Overview string `json:"overview"`
	Context  string `json:"context"`
}

func ListGlossary(graph KnowledgeGraph) []GlossaryEntry {
	return graph.Glossary
}

func GetGlossaryEntry(graph KnowledgeGraph, term string) (GlossaryEntry, bool) {
	needle := normalizeLookup(term)
	if needle == "" {
		return GlossaryEntry{}, false
	}
	for _, entry := range graph.Glossary {
		if normalizeLookup(entry.Term) == needle {
			return entry, true
		}
		for _, alias := range entry.Aliases {
			if normalizeLookup(alias) == needle {
				return entry, true
			}
		}
	}
	return GlossaryEntry{}, false
}

func ListSectionSummaries(graph KnowledgeGraph, group string) []SectionSummary {
	wantedGroup := normalizeLookup(group)
	sections := make([]SectionSummary, 0, len(graph.Nodes))
	for _, node := range graph.Nodes {
		if wantedGroup != "" {
			nodeGroup := ""
			if node.Group != nil {
				nodeGroup = *node.Group
			}
			if normalizeLookup(nodeGroup) != wantedGroup {
				continue
			}
		}
		sections = append(sections, SectionSummary{
			ID:      node.ID,
			Title:   node.Title,
			Heading: node.Heading,
			Group:   node.Group,
			URL:     node.URL,
		})
	}
	return sections
}

func GetSection(graph KnowledgeGraph, id string) (KnowledgeNode, bool) {
	needle := strings.TrimSpace(decodeValue(id))
	if needle == "" {
		return KnowledgeNode{}, false
	}
	for _, node := range graph.Nodes {
		if node.ID == needle {
			return node, true
		}
	}
	return KnowledgeNode{}, false
}

func GetOverview(graph KnowledgeGraph) Overview {
	return Overview{Overview: graph.Overview, Context: graph.Context}
}

func decodeValue(value string) string {
	decoded, err := url.PathUnescape(value)
	if err != nil {
		return value
	}
	return decoded
}

func normalizeLookup(value string) string {
	return strings.ToLower(strings.TrimSpace(decodeValue(value)))
}
