package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	askpkg "github.com/hev/ask/pkg/ask"
)

type options struct {
	kgPath            string
	endpoint          string
	jsonOutput        bool
	maxResults        int
	collections       []string
	basePath          string
	contentGlobs      []string
	chunkHeadingDepth int
	buildCommand      string
	skipBuild         bool
	strict            bool
	kgModel           string
}

func main() {
	if err := run(context.Background(), os.Args[1:], os.Stdout, os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, "ask:", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string, stdout io.Writer, stderr io.Writer) error {
	opts, commandArgs, err := parseGlobalFlags(args)
	if err != nil {
		return err
	}
	if len(commandArgs) == 0 {
		usage(stderr)
		return errors.New("missing command")
	}
	jsonOut := opts.jsonOutput || !isTerminal(os.Stdout)
	command := commandArgs[0]
	rest := commandArgs[1:]

	switch command {
	case "glossary":
		return runGlossary(ctx, opts, rest, stdout, jsonOut)
	case "sections":
		return runSections(ctx, opts, rest, stdout, jsonOut)
	case "section":
		return runSection(ctx, opts, rest, stdout, jsonOut)
	case "overview":
		if len(rest) != 0 {
			return fmt.Errorf("overview takes no arguments")
		}
		return runOverview(ctx, opts, stdout, jsonOut)
	case "search":
		if len(rest) == 0 {
			return fmt.Errorf("search requires a query")
		}
		return runSearch(ctx, opts, strings.Join(rest, " "), stdout, jsonOut)
	case "answer":
		if len(rest) == 0 {
			return fmt.Errorf("answer requires a query")
		}
		return runAnswer(ctx, opts, strings.Join(rest, " "), stdout, jsonOut)
	case "kg":
		return runKG(ctx, opts, rest, stdout)
	case "mcp":
		if len(rest) != 0 {
			return fmt.Errorf("mcp takes no arguments")
		}
		return askpkg.ServeMCP(ctx, askpkg.MCPOptions{
			KGPath:     opts.kgPath,
			Endpoint:   opts.endpoint,
			MaxResults: opts.maxResults,
		}, os.Stdin, stdout)
	case "help", "-h", "--help":
		usage(stdout)
		return nil
	default:
		usage(stderr)
		return fmt.Errorf("unknown command %q", command)
	}
}

func runKG(_ context.Context, opts options, args []string, stdout io.Writer) error {
	if len(args) == 0 {
		return fmt.Errorf("kg requires build, corpus, assemble, or verify")
	}
	command := args[0]
	rest := args[1:]
	var err error
	buildOptions := askpkg.BuildOptions{
		SiteRoot:          ".",
		Collections:       opts.collections,
		BasePath:          opts.basePath,
		KGPath:            opts.kgPath,
		KGContentGlobs:    opts.contentGlobs,
		ChunkHeadingDepth: opts.chunkHeadingDepth,
	}

	switch command {
	case "corpus":
		outPath, rest, err := parseValueFlagDefault(rest, "--out", ".hev-ask/kg-input.json")
		if err != nil {
			return err
		}
		buildOptions, rest, err = parseBuildFlags(buildOptions, rest)
		if err != nil {
			return err
		}
		if len(rest) != 0 {
			return fmt.Errorf("kg corpus got unexpected arguments: %s", strings.Join(rest, " "))
		}
		path, upToDate, sections, err := askpkg.WriteCorpusInput(buildOptions, outPath)
		if err != nil {
			return err
		}
		state := "needs-rebuild"
		if upToDate {
			state = "up-to-date"
		}
		fmt.Fprintf(stdout, "[hev-ask] kg:corpus %s (%d sections, %s)\n", path, sections, state)
		return nil
	case "assemble":
		inputPath, rest, err := parseValueFlagDefault(rest, "--input", ".hev-ask/kg-distill.json")
		if err != nil {
			return err
		}
		buildOptions, rest, err = parseBuildFlags(buildOptions, rest)
		if err != nil {
			return err
		}
		if len(rest) != 0 {
			return fmt.Errorf("kg assemble got unexpected arguments: %s", strings.Join(rest, " "))
		}
		result, err := askpkg.AssembleFromDistillation(buildOptions, inputPath)
		if err != nil {
			return err
		}
		fmt.Fprintf(stdout, "[hev-ask] kg:%s %s (%d chunks)\n", result.Status, result.Path, result.Chunks)
		return nil
	case "build":
		buildOptions, rest, err = parseBuildFlags(buildOptions, rest)
		if err != nil {
			return err
		}
		kgModel, rest, err := parseValueFlagDefault(rest, "--kg-model", opts.kgModel)
		if err != nil {
			return err
		}
		if len(rest) != 0 {
			return fmt.Errorf("kg build got unexpected arguments: %s", strings.Join(rest, " "))
		}
		result, err := askpkg.BuildKnowledgeGraph(askpkg.BuildKnowledgeGraphOptions{
			BuildOptions: buildOptions,
			KGModel:      kgModel,
		})
		if err != nil {
			return err
		}
		fmt.Fprintf(stdout, "[hev-ask] kg:%s %s (%d chunks)\n", result.Status, result.Path, result.Chunks)
		return nil
	case "verify":
		buildOptions, rest, err = parseBuildFlags(buildOptions, rest)
		if err != nil {
			return err
		}
		verifyOptions := askpkg.VerifyOptions{
			BuildOptions: buildOptions,
			BuildCommand: opts.buildCommand,
			SkipBuild:    opts.skipBuild,
		}
		verifyOptions, rest, err = parseVerifyFlags(verifyOptions, rest)
		if err != nil {
			return err
		}
		if len(rest) != 0 {
			return fmt.Errorf("kg verify got unexpected arguments: %s", strings.Join(rest, " "))
		}
		result, err := askpkg.VerifyAnchors(verifyOptions)
		if err != nil {
			return err
		}
		return writeVerifyResult(stdout, result, opts.strict)
	default:
		return fmt.Errorf("unknown kg command %q", command)
	}
}

func runGlossary(ctx context.Context, opts options, args []string, stdout io.Writer, jsonOut bool) error {
	subcommand := "list"
	if len(args) > 0 {
		subcommand = args[0]
		args = args[1:]
	}
	switch subcommand {
	case "list":
		if len(args) != 0 {
			return fmt.Errorf("glossary list takes no arguments")
		}
		if opts.endpoint != "" {
			terms, err := askpkg.NewEndpointClient(opts.endpoint).ListGlossary(ctx)
			if err != nil {
				return err
			}
			return writeOutput(stdout, jsonOut, map[string]any{"terms": terms}, func(w io.Writer) {
				writeGlossaryList(w, terms)
			})
		}
		graph, err := askpkg.LoadGraph(opts.kgPath)
		if err != nil {
			return err
		}
		terms := askpkg.ListGlossary(graph)
		return writeOutput(stdout, jsonOut, map[string]any{"terms": terms}, func(w io.Writer) {
			writeGlossaryList(w, terms)
		})
	case "get":
		if len(args) == 0 {
			return fmt.Errorf("glossary get requires a term")
		}
		term := strings.Join(args, " ")
		if opts.endpoint != "" {
			entry, err := askpkg.NewEndpointClient(opts.endpoint).GetGlossaryEntry(ctx, term)
			if err != nil {
				return err
			}
			return writeOutput(stdout, jsonOut, entry, func(w io.Writer) { writeGlossaryEntry(w, entry) })
		}
		graph, err := askpkg.LoadGraph(opts.kgPath)
		if err != nil {
			return err
		}
		entry, ok := askpkg.GetGlossaryEntry(graph, term)
		if !ok {
			return fmt.Errorf("no glossary entry matched %q", term)
		}
		return writeOutput(stdout, jsonOut, entry, func(w io.Writer) { writeGlossaryEntry(w, entry) })
	default:
		return fmt.Errorf("unknown glossary command %q", subcommand)
	}
}

func runSections(ctx context.Context, opts options, args []string, stdout io.Writer, jsonOut bool) error {
	subcommand := "list"
	if len(args) > 0 && !strings.HasPrefix(args[0], "--") {
		subcommand = args[0]
		args = args[1:]
	}
	if subcommand != "list" {
		return fmt.Errorf("unknown sections command %q", subcommand)
	}
	group, rest, err := parseValueFlag(args, "--group")
	if err != nil {
		return err
	}
	if len(rest) != 0 {
		return fmt.Errorf("sections list got unexpected arguments: %s", strings.Join(rest, " "))
	}
	if opts.endpoint != "" {
		sections, err := askpkg.NewEndpointClient(opts.endpoint).ListSections(ctx, group)
		if err != nil {
			return err
		}
		return writeOutput(stdout, jsonOut, map[string]any{"sections": sections}, func(w io.Writer) {
			writeSections(w, sections)
		})
	}
	graph, err := askpkg.LoadGraph(opts.kgPath)
	if err != nil {
		return err
	}
	sections := askpkg.ListSectionSummaries(graph, group)
	return writeOutput(stdout, jsonOut, map[string]any{"sections": sections}, func(w io.Writer) {
		writeSections(w, sections)
	})
}

func runSection(ctx context.Context, opts options, args []string, stdout io.Writer, jsonOut bool) error {
	if len(args) == 0 || args[0] != "get" {
		return fmt.Errorf("usage: ask section get <id>")
	}
	if len(args) < 2 {
		return fmt.Errorf("section get requires an id")
	}
	id := strings.Join(args[1:], " ")
	if opts.endpoint != "" {
		node, err := askpkg.NewEndpointClient(opts.endpoint).GetSection(ctx, id)
		if err != nil {
			return err
		}
		return writeOutput(stdout, jsonOut, node, func(w io.Writer) { writeSection(w, node) })
	}
	graph, err := askpkg.LoadGraph(opts.kgPath)
	if err != nil {
		return err
	}
	node, ok := askpkg.GetSection(graph, id)
	if !ok {
		return fmt.Errorf("no section matched %q", id)
	}
	return writeOutput(stdout, jsonOut, node, func(w io.Writer) { writeSection(w, node) })
}

func runOverview(ctx context.Context, opts options, stdout io.Writer, jsonOut bool) error {
	if opts.endpoint != "" {
		overview, err := askpkg.NewEndpointClient(opts.endpoint).Overview(ctx)
		if err != nil {
			return err
		}
		return writeOutput(stdout, jsonOut, overview, func(w io.Writer) { writeOverview(w, overview) })
	}
	graph, err := askpkg.LoadGraph(opts.kgPath)
	if err != nil {
		return err
	}
	overview := askpkg.GetOverview(graph)
	return writeOutput(stdout, jsonOut, overview, func(w io.Writer) { writeOverview(w, overview) })
}

func runSearch(ctx context.Context, opts options, query string, stdout io.Writer, jsonOut bool) error {
	if opts.endpoint != "" {
		response, err := askpkg.NewEndpointClient(opts.endpoint).Search(ctx, query)
		if err != nil {
			return err
		}
		return writeOutput(stdout, jsonOut, response, func(w io.Writer) { writeSearchResults(w, response) })
	}
	graph, err := askpkg.LoadGraph(opts.kgPath)
	if err != nil {
		return err
	}
	response := askpkg.SearchGraph(graph, query, askpkg.SearchOptions{MaxResults: opts.maxResults})
	return writeOutput(stdout, jsonOut, response, func(w io.Writer) { writeSearchResults(w, response) })
}

func runAnswer(ctx context.Context, opts options, query string, stdout io.Writer, jsonOut bool) error {
	if opts.endpoint == "" {
		return errors.New("answer requires --endpoint for the remote SSE answer path; without --endpoint, use search for keyless local retrieval")
	}
	encoder := json.NewEncoder(stdout)
	return askpkg.NewEndpointClient(opts.endpoint).StreamAnswer(ctx, query, func(event askpkg.AnswerEvent) error {
		if jsonOut {
			return encoder.Encode(event)
		}
		switch event.Event {
		case "token":
			var payload struct {
				Text string `json:"text"`
			}
			if err := json.Unmarshal(event.Data, &payload); err != nil {
				return err
			}
			_, err := io.WriteString(stdout, payload.Text)
			return err
		case "keyword":
			var response askpkg.KeywordResponse
			if err := json.Unmarshal(event.Data, &response); err != nil {
				return err
			}
			writeSearchResults(stdout, response)
		case "done":
			_, err := io.WriteString(stdout, "\n")
			return err
		}
		return nil
	})
}

func parseGlobalFlags(args []string) (options, []string, error) {
	opts := options{kgPath: ".hev-ask/kg.json", maxResults: 8, basePath: "/docs/", chunkHeadingDepth: 3}
	var rest []string
	for i := 0; i < len(args); i++ {
		arg := args[i]
		switch arg {
		case "--kg-path":
			if i+1 >= len(args) {
				return opts, nil, fmt.Errorf("--kg-path requires a value")
			}
			opts.kgPath = args[i+1]
			i++
		case "--endpoint":
			if i+1 >= len(args) {
				return opts, nil, fmt.Errorf("--endpoint requires a value")
			}
			opts.endpoint = args[i+1]
			i++
		case "--json":
			opts.jsonOutput = true
		case "--max-results":
			if i+1 >= len(args) {
				return opts, nil, fmt.Errorf("--max-results requires a value")
			}
			var value int
			if _, err := fmt.Sscanf(args[i+1], "%d", &value); err != nil || value <= 0 {
				return opts, nil, fmt.Errorf("--max-results must be a positive integer")
			}
			opts.maxResults = value
			i++
		case "--collection":
			if i+1 >= len(args) {
				return opts, nil, fmt.Errorf("--collection requires a value")
			}
			opts.collections = append(opts.collections, args[i+1])
			i++
		case "--base-path":
			if i+1 >= len(args) {
				return opts, nil, fmt.Errorf("--base-path requires a value")
			}
			opts.basePath = args[i+1]
			i++
		case "--content-glob":
			if i+1 >= len(args) {
				return opts, nil, fmt.Errorf("--content-glob requires a value")
			}
			opts.contentGlobs = append(opts.contentGlobs, args[i+1])
			i++
		case "--chunk-heading-depth":
			if i+1 >= len(args) {
				return opts, nil, fmt.Errorf("--chunk-heading-depth requires a value")
			}
			var value int
			if _, err := fmt.Sscanf(args[i+1], "%d", &value); err != nil || value <= 0 {
				return opts, nil, fmt.Errorf("--chunk-heading-depth must be a positive integer")
			}
			opts.chunkHeadingDepth = value
			i++
		case "--build-command":
			if i+1 >= len(args) {
				return opts, nil, fmt.Errorf("--build-command requires a value")
			}
			opts.buildCommand = args[i+1]
			i++
		case "--kg-model":
			if i+1 >= len(args) {
				return opts, nil, fmt.Errorf("--kg-model requires a value")
			}
			opts.kgModel = args[i+1]
			i++
		case "--skip-build":
			opts.skipBuild = true
		case "--strict":
			opts.strict = true
		default:
			rest = append(rest, arg)
		}
	}
	return opts, rest, nil
}

func parseVerifyFlags(options askpkg.VerifyOptions, args []string) (askpkg.VerifyOptions, []string, error) {
	var rest []string
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--build-command":
			if i+1 >= len(args) {
				return options, nil, fmt.Errorf("--build-command requires a value")
			}
			options.BuildCommand = args[i+1]
			i++
		case "--skip-build":
			options.SkipBuild = true
		case "--dist-dir":
			if i+1 >= len(args) {
				return options, nil, fmt.Errorf("--dist-dir requires a value")
			}
			options.DistDir = args[i+1]
			i++
		case "--strict":
			// Parsed globally for failure handling. Accept it here too so the
			// flag works after the subcommand.
			i += 0
		default:
			rest = append(rest, args[i])
		}
	}
	return options, rest, nil
}

func parseValueFlagDefault(args []string, name string, fallback string) (string, []string, error) {
	value, rest, err := parseValueFlag(args, name)
	if err != nil {
		return "", nil, err
	}
	if value == "" {
		value = fallback
	}
	return value, rest, nil
}

func parseBuildFlags(options askpkg.BuildOptions, args []string) (askpkg.BuildOptions, []string, error) {
	var rest []string
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "--collection":
			if i+1 >= len(args) {
				return options, nil, fmt.Errorf("--collection requires a value")
			}
			options.Collections = append(options.Collections, args[i+1])
			i++
		case "--base-path":
			if i+1 >= len(args) {
				return options, nil, fmt.Errorf("--base-path requires a value")
			}
			options.BasePath = args[i+1]
			i++
		case "--kg-path":
			if i+1 >= len(args) {
				return options, nil, fmt.Errorf("--kg-path requires a value")
			}
			options.KGPath = args[i+1]
			i++
		case "--content-glob":
			if i+1 >= len(args) {
				return options, nil, fmt.Errorf("--content-glob requires a value")
			}
			options.KGContentGlobs = append(options.KGContentGlobs, args[i+1])
			i++
		case "--chunk-heading-depth":
			if i+1 >= len(args) {
				return options, nil, fmt.Errorf("--chunk-heading-depth requires a value")
			}
			var value int
			if _, err := fmt.Sscanf(args[i+1], "%d", &value); err != nil || value <= 0 {
				return options, nil, fmt.Errorf("--chunk-heading-depth must be a positive integer")
			}
			options.ChunkHeadingDepth = value
			i++
		case "--kg-model":
			// Parsed by kg build after common build flags.
			rest = append(rest, args[i])
		default:
			rest = append(rest, args[i])
		}
	}
	return options, rest, nil
}

func parseValueFlag(args []string, name string) (string, []string, error) {
	var value string
	var rest []string
	for i := 0; i < len(args); i++ {
		if args[i] != name {
			rest = append(rest, args[i])
			continue
		}
		if i+1 >= len(args) {
			return "", nil, fmt.Errorf("%s requires a value", name)
		}
		value = args[i+1]
		i++
	}
	return value, rest, nil
}

func writeOutput(stdout io.Writer, jsonOut bool, value any, human func(io.Writer)) error {
	if !jsonOut {
		human(stdout)
		return nil
	}
	encoder := json.NewEncoder(stdout)
	encoder.SetIndent("", "  ")
	return encoder.Encode(value)
}

func writeGlossaryList(w io.Writer, terms []askpkg.GlossaryEntry) {
	for _, term := range terms {
		fmt.Fprintf(w, "%s", term.Term)
		if len(term.Aliases) > 0 {
			fmt.Fprintf(w, " (%s)", strings.Join(term.Aliases, ", "))
		}
		fmt.Fprintf(w, "\n  %s\n", term.Definition)
	}
}

func writeGlossaryEntry(w io.Writer, entry askpkg.GlossaryEntry) {
	fmt.Fprintf(w, "%s\n", entry.Term)
	if len(entry.Aliases) > 0 {
		fmt.Fprintf(w, "Aliases: %s\n", strings.Join(entry.Aliases, ", "))
	}
	fmt.Fprintf(w, "%s\n", entry.Definition)
}

func writeSections(w io.Writer, sections []askpkg.SectionSummary) {
	for _, section := range sections {
		label := section.Title
		if section.Heading != nil && *section.Heading != "" {
			label += " > " + *section.Heading
		}
		fmt.Fprintf(w, "%s\t%s\t%s\n", section.ID, label, section.URL)
	}
}

func writeSection(w io.Writer, node askpkg.KnowledgeNode) {
	fmt.Fprintf(w, "%s\n", node.Title)
	if node.Heading != nil && *node.Heading != "" {
		fmt.Fprintf(w, "Heading: %s\n", *node.Heading)
	}
	if node.Group != nil && *node.Group != "" {
		fmt.Fprintf(w, "Group: %s\n", *node.Group)
	}
	fmt.Fprintf(w, "URL: %s\n\n%s\n", node.URL, node.Summary)
	if len(node.Facts) > 0 {
		fmt.Fprintln(w, "\nFacts:")
		for _, fact := range node.Facts {
			fmt.Fprintf(w, "- %s\n", fact.Literal)
		}
	}
}

func writeOverview(w io.Writer, overview askpkg.Overview) {
	if strings.TrimSpace(overview.Context) != "" {
		fmt.Fprintf(w, "%s\n\n", overview.Context)
	}
	fmt.Fprintln(w, overview.Overview)
}

func writeSearchResults(w io.Writer, response askpkg.KeywordResponse) {
	if response.Warning != "" {
		fmt.Fprintf(w, "Warning: %s\n\n", response.Warning)
	}
	for _, result := range response.Results {
		label := result.Title
		if result.Heading != nil && *result.Heading != "" {
			label += " > " + *result.Heading
		}
		fmt.Fprintf(w, "%s\n%s\n%s\n\n", label, result.URL, result.Snippet)
	}
}

func writeVerifyResult(w io.Writer, result askpkg.VerifyResult, strict bool) error {
	failed := false
	for _, missing := range result.Missing {
		fmt.Fprintf(w, "[hev-ask] missing anchor %s for %s in %s\n", missing.AnchorID, missing.URL, missing.File)
		failed = true
	}
	if len(result.Uncovered) > 0 {
		sample := result.Uncovered
		more := ""
		if len(sample) > 5 {
			more = fmt.Sprintf(", …(+%d)", len(sample)-5)
			sample = sample[:5]
		}
		fmt.Fprintf(w, "[hev-ask] %d section(s) missing from the graph: %s%s — run `ask kg build`.\n", len(result.Uncovered), strings.Join(sample, ", "), more)
		if strict {
			failed = true
		}
	}
	if len(result.Dropped) > 0 {
		fmt.Fprintf(w, "[hev-ask] %d source literal(s) dropped from agent-primary nodes — run `ask kg build`:\n", len(result.Dropped))
		limit := len(result.Dropped)
		if limit > 8 {
			limit = 8
		}
		for _, drop := range result.Dropped[:limit] {
			fmt.Fprintf(w, "  - %s: %s\n", drop.ID, drop.Literal)
		}
		if strict {
			failed = true
		}
	}
	if failed {
		return errors.New("verification failed")
	}
	warnings := ""
	if len(result.Uncovered) > 0 || len(result.Dropped) > 0 {
		warnings = " (with warnings)"
	}
	fmt.Fprintf(w, "[hev-ask] verified %d anchors%s\n", result.Checked, warnings)
	return nil
}

func usage(w io.Writer) {
	fmt.Fprintln(w, `Usage:
  ask [--kg-path .hev-ask/kg.json] [--endpoint URL] [--json] <command>

Commands:
  kg build [--kg-model model]
  kg corpus [--out path]
  kg assemble [--input path]
  kg verify [--skip-build] [--strict]
  glossary list
  glossary get <term>
  sections list [--group GROUP]
  section get <id>
  overview
  search <query>
  answer <query>          requires --endpoint in this implementation
  mcp                     run the MCP stdio server`)
}

func isTerminal(file *os.File) bool {
	info, err := file.Stat()
	if err != nil {
		return false
	}
	return (info.Mode() & os.ModeCharDevice) != 0
}
