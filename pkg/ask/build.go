package ask

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

type BuildOptions struct {
	SiteRoot          string
	Collections       []string
	BasePath          string
	KGPath            string
	KGContentGlobs    []string
	ChunkHeadingDepth int
}

type CorpusBuild struct {
	Documents   []SourceDocument
	Chunks      []Chunk
	ContentHash string
}

type KnowledgeGraphInput struct {
	ContentHash string          `json:"contentHash"`
	KGPath      string          `json:"kgPath"`
	UpToDate    bool            `json:"upToDate"`
	Sections    []CorpusSection `json:"sections"`
}

type CorpusSection struct {
	ID    string `json:"id"`
	URL   string `json:"url"`
	Title string `json:"title"`
	Text  string `json:"text"`
}

type EmittedDistillation struct {
	Context     string             `json:"context"`
	Glossary    []GlossaryEntry    `json:"glossary"`
	Summaries   []SectionSummaryIn `json:"summaries"`
	Suggestions []string           `json:"suggestions"`
}

type SectionSummaryIn struct {
	ID      string `json:"id"`
	Summary string `json:"summary"`
}

type BuildResult struct {
	Status      string
	Path        string
	ContentHash string
	Chunks      int
}

func BuildCorpus(options BuildOptions) (CorpusBuild, error) {
	normalizeBuildOptions(&options)
	files, err := resolveContentFiles(options.SiteRoot, options.Collections, options.KGContentGlobs)
	if err != nil {
		return CorpusBuild{}, err
	}
	documents := make([]SourceDocument, 0, len(files))
	for _, file := range files {
		raw, err := os.ReadFile(file)
		if err != nil {
			return CorpusBuild{}, fmt.Errorf("read content file %q: %w", file, err)
		}
		parsed := ParseFrontmatter(string(raw))
		slug := slugFromFile(options.SiteRoot, file, options.Collections)
		documents = append(documents, SourceDocument{
			Slug:        slug,
			Title:       stringField(parsed.Data, "title", slug),
			Group:       stringField(parsed.Data, "group", ""),
			Description: stringField(parsed.Data, "description", ""),
			Body:        parsed.Body,
		})
	}
	sort.Slice(documents, func(i, j int) bool { return documents[i].Slug < documents[j].Slug })

	chunks := []Chunk{}
	for _, doc := range documents {
		chunks = append(chunks, ChunkDocument(doc, options.BasePath, options.ChunkHeadingDepth)...)
	}
	sort.Slice(chunks, func(i, j int) bool { return chunks[i].ID < chunks[j].ID })
	return CorpusBuild{Documents: documents, Chunks: chunks, ContentHash: SHA256Hex(HashableChunkText(chunks))}, nil
}

func CorpusSections(corpus CorpusBuild) []CorpusSection {
	sections := make([]CorpusSection, 0, len(corpus.Chunks))
	for _, chunk := range corpus.Chunks {
		title := chunk.DocTitle
		if chunk.Heading != "" {
			title += " > " + chunk.Heading
		}
		sections = append(sections, CorpusSection{ID: chunk.ID, URL: chunk.URL, Title: title, Text: chunk.Text})
	}
	return sections
}

func WriteCorpusInput(options BuildOptions, outPath string) (string, bool, int, error) {
	normalizeBuildOptions(&options)
	corpus, err := BuildCorpus(options)
	if err != nil {
		return "", false, 0, err
	}
	committed, err := LoadGraph(resolveSitePath(options.SiteRoot, options.KGPath))
	upToDate := err == nil && committed.Version == 2 && committed.ContentHash == corpus.ContentHash && len(committed.Nodes) > 0
	payload := KnowledgeGraphInput{
		ContentHash: corpus.ContentHash,
		KGPath:      options.KGPath,
		UpToDate:    upToDate,
		Sections:    CorpusSections(corpus),
	}
	out := resolveSitePath(options.SiteRoot, outPath)
	if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
		return "", false, 0, err
	}
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", false, 0, err
	}
	if err := os.WriteFile(out, append(data, '\n'), 0o644); err != nil {
		return "", false, 0, err
	}
	return out, upToDate, len(payload.Sections), nil
}

func AssembleFromDistillation(options BuildOptions, inputPath string) (BuildResult, error) {
	normalizeBuildOptions(&options)
	input := resolveSitePath(options.SiteRoot, inputPath)
	data, err := os.ReadFile(input)
	if err != nil {
		return BuildResult{}, fmt.Errorf("could not read distillation JSON at %s: %w", inputPath, err)
	}
	var emitted EmittedDistillation
	if err := json.Unmarshal(data, &emitted); err != nil {
		return BuildResult{}, fmt.Errorf("parse distillation JSON at %s: %w", inputPath, err)
	}
	normalizeDistillation(&emitted)
	corpus, err := BuildCorpus(options)
	if err != nil {
		return BuildResult{}, err
	}
	graph := AssembleGraph(emitted, corpus)
	out := resolveSitePath(options.SiteRoot, options.KGPath)
	if err := WriteGraph(out, graph); err != nil {
		return BuildResult{}, err
	}
	return BuildResult{Status: "built", Path: out, ContentHash: corpus.ContentHash, Chunks: len(corpus.Chunks)}, nil
}

func AssembleGraph(emitted EmittedDistillation, corpus CorpusBuild) KnowledgeGraph {
	summaryByID := map[string]string{}
	for _, entry := range emitted.Summaries {
		summaryByID[entry.ID] = entry.Summary
	}
	graph := KnowledgeGraph{
		Version:     2,
		GeneratedAt: time.Now().UTC().Format("2006-01-02T15:04:05.000Z"),
		ContentHash: corpus.ContentHash,
		Context:     emitted.Context,
		Glossary:    emitted.Glossary,
		Overview:    BuildOverview(corpus.Chunks),
		Suggestions: emitted.Suggestions,
		Nodes:       BuildNodes(corpus.Chunks, summaryByID),
		Edges:       []KnowledgeEdge{},
	}
	normalizeGraph(&graph)
	return graph
}

func BuildNodes(chunks []Chunk, summaryByID map[string]string) []KnowledgeNode {
	nodes := make([]KnowledgeNode, 0, len(chunks))
	for _, chunk := range chunks {
		facts := ExtractFacts(chunk.ID, chunk.Raw)
		summary := strings.TrimSpace(summaryByID[chunk.ID])
		if summary == "" {
			summary = textExcerpt(chunk.Text, 220)
		}
		factText := make([]string, 0, len(facts))
		for _, fact := range facts {
			factText = append(factText, fact.Literal)
		}
		var heading *string
		if chunk.Heading != "" {
			value := chunk.Heading
			heading = &value
		}
		var group *string
		if chunk.Group != "" {
			value := chunk.Group
			group = &value
		}
		var anchor *string
		if chunk.AnchorID != "" {
			value := chunk.AnchorID
			anchor = &value
		}
		nodes = append(nodes, KnowledgeNode{
			ID:      chunk.ID,
			Kind:    "section",
			Title:   chunk.DocTitle,
			Heading: heading,
			Group:   group,
			URL:     chunk.URL,
			Summary: summary,
			Facts:   facts,
			Sources: []SourceRef{{ChunkID: chunk.ID, URL: chunk.URL, Anchor: anchor}},
			Mode:    ClassifyMode(chunk.Group),
			Terms:   DistinctiveTokens(strings.Join([]string{chunk.Heading, summary, strings.Join(factText, " "), chunk.Text}, " "), 40),
		})
	}
	sort.Slice(nodes, func(i, j int) bool { return nodes[i].ID < nodes[j].ID })
	return nodes
}

func BuildOverview(chunks []Chunk) string {
	byGroup := map[string][]Chunk{}
	for _, chunk := range chunks {
		group := chunk.Group
		if group == "" {
			group = "Docs"
		}
		byGroup[group] = append(byGroup[group], chunk)
	}
	groups := make([]string, 0, len(byGroup))
	for group := range byGroup {
		groups = append(groups, group)
	}
	sort.Strings(groups)
	lines := []string{}
	for _, group := range groups {
		lines = append(lines, "## "+group)
		for _, chunk := range byGroup[group] {
			label := chunk.DocTitle
			if chunk.Heading != "" {
				label = chunk.Heading
			}
			lines = append(lines, "- "+label+" \u2014 `"+chunk.ID+"`")
		}
	}
	return strings.Join(lines, "\n")
}

func WriteGraph(path string, graph KnowledgeGraph) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(graph, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, append(data, '\n'), 0o644)
}

func SHA256Hex(text string) string {
	sum := sha256.Sum256([]byte(text))
	return hex.EncodeToString(sum[:])
}

func normalizeBuildOptions(options *BuildOptions) {
	if options.SiteRoot == "" {
		options.SiteRoot = "."
	}
	if len(options.Collections) == 0 {
		options.Collections = []string{"docs"}
	}
	if options.BasePath == "" {
		options.BasePath = "/docs/"
	}
	if options.KGPath == "" {
		options.KGPath = ".hev-ask/kg.json"
	}
	if options.ChunkHeadingDepth == 0 {
		options.ChunkHeadingDepth = 3
	}
}

func resolveSitePath(siteRoot string, path string) string {
	if filepath.IsAbs(path) {
		return path
	}
	resolved, err := filepath.Abs(filepath.Join(siteRoot, path))
	if err != nil {
		return filepath.Join(siteRoot, path)
	}
	return resolved
}

func normalizeDistillation(emitted *EmittedDistillation) {
	if emitted.Glossary == nil {
		emitted.Glossary = []GlossaryEntry{}
	}
	if emitted.Summaries == nil {
		emitted.Summaries = []SectionSummaryIn{}
	}
	if emitted.Suggestions == nil {
		emitted.Suggestions = []string{}
	}
	cleanSummaries := emitted.Summaries[:0]
	for _, summary := range emitted.Summaries {
		summary.Summary = strings.TrimSpace(summary.Summary)
		if summary.ID == "" || summary.Summary == "" {
			continue
		}
		cleanSummaries = append(cleanSummaries, summary)
	}
	emitted.Summaries = cleanSummaries
	cleanSuggestions := emitted.Suggestions[:0]
	for _, suggestion := range emitted.Suggestions {
		suggestion = strings.TrimSpace(suggestion)
		if suggestion != "" {
			cleanSuggestions = append(cleanSuggestions, suggestion)
		}
	}
	emitted.Suggestions = cleanSuggestions
	for i := range emitted.Glossary {
		if emitted.Glossary[i].Aliases == nil {
			emitted.Glossary[i].Aliases = []string{}
		}
	}
}

func stringField(data map[string]any, key string, fallback string) string {
	if value, ok := data[key].(string); ok {
		return value
	}
	return fallback
}

func resolveContentFiles(siteRoot string, collections []string, globs []string) ([]string, error) {
	if len(globs) == 0 {
		for _, collection := range collections {
			globs = append(globs, "src/content/"+collection+"/**/*.{md,mdx}")
		}
	}
	files := map[string]bool{}
	for _, glob := range globs {
		matched, err := filesForGlob(siteRoot, glob)
		if err != nil {
			return nil, err
		}
		for _, file := range matched {
			files[file] = true
		}
	}
	out := make([]string, 0, len(files))
	for file := range files {
		out = append(out, file)
	}
	sort.Strings(out)
	return out, nil
}

func filesForGlob(siteRoot string, glob string) ([]string, error) {
	normalized := filepath.ToSlash(glob)
	root := filepath.Join(siteRoot, globRoot(normalized))
	re, err := globToRegexp(normalized)
	if err != nil {
		return nil, err
	}
	var out []string
	if err := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if entry.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(siteRoot, path)
		if err != nil {
			return err
		}
		if re.MatchString(filepath.ToSlash(rel)) {
			out = append(out, path)
		}
		return nil
	}); err != nil {
		if os.IsNotExist(err) {
			return []string{}, nil
		}
		return nil, err
	}
	sort.Strings(out)
	return out, nil
}

func globRoot(glob string) string {
	wildcard := strings.IndexAny(glob, "*{")
	if wildcard == -1 {
		return filepath.Dir(glob)
	}
	before := glob[:wildcard]
	root := regexp.MustCompile(`[/\\][^/\\]*$`).ReplaceAllString(before, "")
	if root == "" {
		return "."
	}
	return root
}

func globToRegexp(glob string) (*regexp.Regexp, error) {
	var b strings.Builder
	b.WriteString("^")
	for i := 0; i < len(glob); i++ {
		if strings.HasPrefix(glob[i:], "**/") {
			b.WriteString("(?:.*/)?")
			i += 2
			continue
		}
		switch glob[i] {
		case '*':
			b.WriteString("[^/]*")
		case '{':
			end := strings.IndexByte(glob[i:], '}')
			if end == -1 {
				b.WriteString(regexp.QuoteMeta(string(glob[i])))
				continue
			}
			inner := glob[i+1 : i+end]
			parts := strings.Split(inner, ",")
			for j, part := range parts {
				parts[j] = regexp.QuoteMeta(part)
			}
			b.WriteString("(" + strings.Join(parts, "|") + ")")
			i += end
		default:
			b.WriteString(regexp.QuoteMeta(string(glob[i])))
		}
	}
	b.WriteString("$")
	return regexp.Compile(b.String())
}

func slugFromFile(siteRoot string, file string, collections []string) string {
	normalizedFile, _ := filepath.Abs(file)
	for _, collection := range collections {
		root, _ := filepath.Abs(filepath.Join(siteRoot, "src/content", collection))
		rel, err := filepath.Rel(root, normalizedFile)
		if err == nil && !strings.HasPrefix(rel, "..") && !filepath.IsAbs(rel) {
			return cleanSlug(rel)
		}
	}
	root, _ := filepath.Abs(filepath.Join(siteRoot, "src/content"))
	rel, _ := filepath.Rel(root, normalizedFile)
	return cleanSlug(rel)
}

func cleanSlug(rel string) string {
	slug := filepath.ToSlash(rel)
	slug = regexp.MustCompile(`(?i)\.(md|mdx)$`).ReplaceAllString(slug, "")
	return strings.TrimSuffix(slug, "/index")
}

func textExcerpt(text string, max int) string {
	trimmed := strings.Join(strings.Fields(text), " ")
	runes := []rune(trimmed)
	if len(runes) <= max {
		return trimmed
	}
	return strings.TrimSpace(string(runes[:max])) + "\u2026"
}
