package ask

import (
	"regexp"
	"strings"
)

const (
	maxFacts   = 24
	maxLiteral = 400
)

var (
	fenceRE       = regexp.MustCompile("```[a-zA-Z0-9]*\n([\\s\\S]*?)```")
	inlineCodeFRE = regexp.MustCompile("`([^`\n]+)`")
	flagRE        = regexp.MustCompile(`(^|[^\w-])(--?[a-zA-Z][\w-]*)`)
	versionRE     = regexp.MustCompile(`\bv?\d+(?:\.\d+)+\b`)
	modelIDRE     = regexp.MustCompile(`(?i)\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\d[a-z0-9-]*\b`)
	dottedRE      = regexp.MustCompile(`(?i)\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b`)
)

func ExtractFacts(chunkID string, raw string) []Fact {
	seen := map[string]bool{}
	facts := []Fact{}
	push := func(kind string, literal string) {
		value := strings.TrimSpace(literal)
		runeLen := len([]rune(value))
		if runeLen < 2 || runeLen > maxLiteral || seen[value] {
			return
		}
		seen[value] = true
		facts = append(facts, Fact{Kind: kind, Literal: value, ChunkID: chunkID})
	}

	for _, match := range fenceRE.FindAllStringSubmatch(raw, -1) {
		push("code", match[1])
	}
	rest := fenceRE.ReplaceAllString(raw, " ")
	for _, match := range inlineCodeFRE.FindAllStringSubmatch(rest, -1) {
		push("code", match[1])
	}
	bare := inlineCodeFRE.ReplaceAllString(rest, " ")
	for _, match := range flagRE.FindAllStringSubmatch(bare, -1) {
		push("flag", match[2])
	}
	for _, match := range modelIDRE.FindAllString(bare, -1) {
		push("value", match)
	}
	for _, match := range dottedRE.FindAllString(bare, -1) {
		push("value", match)
	}
	for _, match := range versionRE.FindAllString(bare, -1) {
		push("value", match)
	}
	if len(facts) > maxFacts {
		return facts[:maxFacts]
	}
	return facts
}

func ClassifyMode(group string) string {
	if regexp.MustCompile(`(?i)reference|api`).MatchString(group) {
		return "source-primary"
	}
	return "agent-primary"
}

var stopwords = map[string]bool{
	"the": true, "and": true, "for": true, "with": true, "that": true, "this": true,
	"from": true, "into": true, "are": true, "was": true, "has": true, "have": true,
	"its": true, "use": true, "used": true, "using": true, "can": true, "will": true,
	"when": true, "where": true, "how": true, "what": true, "which": true, "each": true,
	"all": true, "one": true, "two": true, "per": true, "via": true, "not": true,
	"but": true, "you": true, "your": true, "they": true, "them": true, "then": true,
	"than": true, "over": true,
}

func DistinctiveTokens(text string, cap int) []string {
	if cap <= 0 {
		cap = 40
	}
	out := []string{}
	seen := map[string]bool{}
	for _, token := range Tokenize(text) {
		if len(token) < 4 || stopwords[token] || seen[token] {
			continue
		}
		seen[token] = true
		out = append(out, token)
		if len(out) >= cap {
			break
		}
	}
	return out
}
