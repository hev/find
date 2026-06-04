package ask

import (
	"regexp"
	"sort"
	"strings"
	"unicode"
)

type SourceDocument struct {
	Slug        string
	Title       string
	Group       string
	Description string
	Body        string
}

type Chunk struct {
	ID       string
	DocSlug  string
	DocTitle string
	Group    string
	Heading  string
	AnchorID string
	URL      string
	Text     string
	Raw      string
	Tokens   map[string]bool
}

type sectionDraft struct {
	Heading  string
	AnchorID string
	Lines    []string
}

var (
	headingRE       = regexp.MustCompile(`^(#{1,6})\s+(.+?)\s*#*\s*$`)
	importExportRE  = regexp.MustCompile(`(?m)^\s*(import|export)\s.+$`)
	fenceMarkerRE   = regexp.MustCompile("```[a-zA-Z0-9]*\n?")
	inlineCodeRE    = regexp.MustCompile("`([^`]+)`")
	imageRE         = regexp.MustCompile(`!\[([^\]]*)\]\([^)]*\)`)
	linkRE          = regexp.MustCompile(`\[([^\]]+)\]\([^)]*\)`)
	htmlTagRE       = regexp.MustCompile(`</?[A-Za-z][^>]*>`)
	tableDividerRE  = regexp.MustCompile(`(?m)^\s*\|?[\s:|-]{3,}\|?\s*$`)
	headingMarkerRE = regexp.MustCompile(`(?m)^\s{0,3}#{1,6}\s+`)
	blockquoteRE    = regexp.MustCompile(`(?m)^\s{0,3}>\s?`)
	listMarkerRE    = regexp.MustCompile(`(?m)^\s{0,3}[-*+]\s+`)
	emphasisRE      = regexp.MustCompile(`[*_~]{1,3}`)
	headingStyleRE  = regexp.MustCompile(`[*~]{1,3}`)
	spaceRE         = regexp.MustCompile(`\s+`)
)

func Tokenize(text string) []string {
	return tokenRE.FindAllString(strings.ToLower(text), -1)
}

func CleanMarkdown(src string) string {
	out := importExportRE.ReplaceAllString(src, " ")
	out = fenceMarkerRE.ReplaceAllString(out, " ")
	out = inlineCodeRE.ReplaceAllString(out, "$1")
	out = imageRE.ReplaceAllString(out, "$1")
	out = linkRE.ReplaceAllString(out, "$1")
	out = htmlTagRE.ReplaceAllString(out, " ")
	out = tableDividerRE.ReplaceAllString(out, " ")
	out = strings.ReplaceAll(out, "|", " ")
	out = headingMarkerRE.ReplaceAllString(out, " ")
	out = blockquoteRE.ReplaceAllString(out, " ")
	out = listMarkerRE.ReplaceAllString(out, " ")
	out = emphasisRE.ReplaceAllString(out, "")
	out = spaceRE.ReplaceAllString(out, " ")
	return strings.TrimSpace(out)
}

func cleanHeadingText(src string) string {
	out := inlineCodeRE.ReplaceAllString(src, "$1")
	out = imageRE.ReplaceAllString(out, "$1")
	out = linkRE.ReplaceAllString(out, "$1")
	out = htmlTagRE.ReplaceAllString(out, " ")
	out = headingStyleRE.ReplaceAllString(out, "")
	out = spaceRE.ReplaceAllString(out, " ")
	return strings.TrimSpace(out)
}

func DocSlugToURL(slug string, basePath string) string {
	base := basePath
	if !strings.HasSuffix(base, "/") {
		base += "/"
	}
	if slug == "index" {
		trimmed := strings.TrimSuffix(base, "/")
		if trimmed == "" {
			return "/"
		}
		return trimmed
	}
	return base + strings.TrimSuffix(slug, "/index")
}

func ChunkDocument(doc SourceDocument, basePath string, chunkHeadingDepth int) []Chunk {
	if chunkHeadingDepth < 2 {
		chunkHeadingDepth = 2
	}
	if chunkHeadingDepth > 6 {
		chunkHeadingDepth = 6
	}

	slugger := newSlugger()
	sections := []sectionDraft{{Lines: []string{}}}
	current := 0
	for _, line := range splitLines(doc.Body) {
		match := headingRE.FindStringSubmatch(line)
		if match == nil {
			sections[current].Lines = append(sections[current].Lines, line)
			continue
		}

		level := len(match[1])
		heading := cleanHeadingText(match[2])
		anchorID := slugger.slug(heading)
		if level >= 2 && level <= chunkHeadingDepth {
			sections = append(sections, sectionDraft{Heading: heading, AnchorID: anchorID, Lines: []string{line}})
			current = len(sections) - 1
		} else {
			sections[current].Lines = append(sections[current].Lines, line)
		}
	}

	chunks := make([]Chunk, 0, len(sections))
	for index, section := range sections {
		rawBody := strings.Join(section.Lines, "\n")
		cleanedBody := CleanMarkdown(rawBody)
		textParts := []string{}
		if index == 0 {
			if doc.Description != "" {
				textParts = append(textParts, doc.Description)
			}
			if cleanedBody != "" {
				textParts = append(textParts, cleanedBody)
			}
		} else if cleanedBody != "" {
			textParts = append(textParts, cleanedBody)
		}
		text := strings.TrimSpace(strings.Join(textParts, "\n"))
		if text == "" && section.Heading == "" {
			continue
		}

		url := DocSlugToURL(doc.Slug, basePath)
		id := doc.Slug
		if section.AnchorID != "" {
			url += "#" + section.AnchorID
			id += "#" + section.AnchorID
		}
		chunk := Chunk{
			ID:       id,
			DocSlug:  doc.Slug,
			DocTitle: doc.Title,
			Group:    doc.Group,
			Heading:  section.Heading,
			AnchorID: section.AnchorID,
			URL:      url,
			Text:     text,
			Raw:      rawBody,
			Tokens:   tokenSet(doc.Title + " " + doc.Group + " " + section.Heading + " " + text),
		}
		chunks = append(chunks, chunk)
	}
	return chunks
}

func HashableChunkText(chunks []Chunk) string {
	sorted := append([]Chunk(nil), chunks...)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i].ID < sorted[j].ID })
	parts := make([]string, 0, len(sorted))
	for _, chunk := range sorted {
		parts = append(parts, chunk.ID+"\n"+chunk.Text)
	}
	return strings.Join(parts, "\n---\n")
}

func splitLines(text string) []string {
	return strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
}

func tokenSet(text string) map[string]bool {
	out := map[string]bool{}
	for _, token := range Tokenize(text) {
		out[token] = true
	}
	return out
}

type slugger struct {
	occurrences map[string]int
}

func newSlugger() *slugger {
	return &slugger{occurrences: map[string]int{}}
}

func (s *slugger) slug(value string) string {
	result := githubSlug(value)
	original := result
	for {
		if _, ok := s.occurrences[result]; !ok {
			break
		}
		s.occurrences[original]++
		result = original + "-" + itoa(s.occurrences[original])
	}
	s.occurrences[result] = 0
	return result
}

func githubSlug(value string) string {
	value = strings.ToLower(value)
	var b strings.Builder
	for _, r := range value {
		if r == ' ' {
			b.WriteRune('-')
			continue
		}
		if r == '-' || r == '_' || unicode.IsLetter(r) || unicode.IsNumber(r) {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	var digits [20]byte
	i := len(digits)
	for value > 0 {
		i--
		digits[i] = byte('0' + value%10)
		value /= 10
	}
	return string(digits[i:])
}
