package ask

import (
	"regexp"
	"sort"
	"strings"
)

var tokenRE = regexp.MustCompile(`[a-z0-9]+`)

type SearchOptions struct {
	MaxResults int
}

func SearchGraph(graph KnowledgeGraph, query string, opts SearchOptions) KeywordResponse {
	terms := expandQueryTerms(query, graph.Glossary)
	if opts.MaxResults <= 0 {
		opts.MaxResults = 8
	}
	if len(terms) == 0 {
		return KeywordResponse{Results: []KeywordResult{}, Query: query, Mode: "keyword"}
	}

	type scored struct {
		node  KnowledgeNode
		score int
	}
	scoredNodes := make([]scored, 0, len(graph.Nodes))
	for _, node := range graph.Nodes {
		haystack := nodeTokenSet(node)
		score := 0
		for _, term := range terms {
			if haystack[term] {
				score++
			}
		}
		if score > 0 {
			scoredNodes = append(scoredNodes, scored{node: node, score: score})
		}
	}

	sort.Slice(scoredNodes, func(i, j int) bool {
		if scoredNodes[i].score != scoredNodes[j].score {
			return scoredNodes[i].score > scoredNodes[j].score
		}
		return scoredNodes[i].node.ID < scoredNodes[j].node.ID
	})

	if len(scoredNodes) > opts.MaxResults {
		scoredNodes = scoredNodes[:opts.MaxResults]
	}
	results := make([]KeywordResult, 0, len(scoredNodes))
	for _, item := range scoredNodes {
		results = append(results, KeywordResult{
			Title:   item.node.Title,
			Heading: item.node.Heading,
			URL:     item.node.URL,
			Group:   item.node.Group,
			Snippet: excerpt(item.node.Summary),
		})
	}
	return KeywordResponse{Results: results, Query: query, Mode: "keyword"}
}

func expandQueryTerms(query string, glossary []GlossaryEntry) []string {
	seen := map[string]bool{}
	var terms []string
	add := func(values ...string) {
		for _, value := range values {
			for _, token := range tokenize(value) {
				if !seen[token] {
					seen[token] = true
					terms = append(terms, token)
				}
			}
		}
	}

	add(query)
	queryTokens := map[string]bool{}
	for _, token := range terms {
		queryTokens[token] = true
	}
	for _, entry := range glossary {
		entryTokens := tokenize(entry.Term)
		aliasTokens := tokenize(strings.Join(entry.Aliases, " "))
		matched := false
		for _, token := range entryTokens {
			if queryTokens[token] {
				matched = true
				break
			}
		}
		if !matched {
			for _, token := range aliasTokens {
				if queryTokens[token] {
					matched = true
					break
				}
			}
		}
		if matched {
			add(entry.Term)
			add(entry.Aliases...)
		}
	}
	return terms
}

func nodeTokenSet(node KnowledgeNode) map[string]bool {
	tokens := map[string]bool{}
	add := func(values ...string) {
		for _, value := range values {
			for _, token := range tokenize(value) {
				tokens[token] = true
			}
		}
	}
	add(node.ID, node.Title, node.Summary)
	if node.Heading != nil {
		add(*node.Heading)
	}
	if node.Group != nil {
		add(*node.Group)
	}
	add(node.Terms...)
	for _, fact := range node.Facts {
		add(fact.Literal)
	}
	return tokens
}

func tokenize(value string) []string {
	return tokenRE.FindAllString(strings.ToLower(value), -1)
}

func excerpt(value string) string {
	const max = 220
	text := strings.Join(strings.Fields(value), " ")
	runes := []rune(text)
	if len(runes) <= max {
		return text
	}
	return strings.TrimSpace(string(runes[:max])) + "..."
}
