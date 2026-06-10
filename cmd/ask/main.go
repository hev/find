package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	askpkg "github.com/hev/ask/pkg/ask"
)

type options struct {
	digestPath        string
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
	digestModel       string
	provider          string
	providerURL       string
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
	case "tree", "ls", "head", "cat", "facts", "grep", "glossary", "sections", "section", "overview", "search", "answer", "mcp":
		return askpkg.NewCommandGroup(askpkg.CommandOptions{
			DigestDir:  opts.digestPath,
			Endpoint:   opts.endpoint,
			JSONOutput: jsonOut,
			MaxResults: opts.maxResults,
		}).Run(ctx, commandArgs, os.Stdin, stdout, stderr)
	case "digest":
		return runDigest(ctx, opts, rest, stdout)
	case "help", "-h", "--help":
		usage(stdout)
		return nil
	default:
		usage(stderr)
		return fmt.Errorf("unknown command %q", command)
	}
}

func runDigest(_ context.Context, opts options, args []string, stdout io.Writer) error {
	if len(args) == 0 {
		return fmt.Errorf("digest requires build, corpus, assemble, verify, status, or migrate")
	}
	command := args[0]
	rest := args[1:]
	var err error
	buildOptions := askpkg.BuildOptions{
		SiteRoot:           ".",
		Collections:        opts.collections,
		BasePath:           opts.basePath,
		DigestPath:         opts.digestPath,
		DigestContentGlobs: opts.contentGlobs,
		ChunkHeadingDepth:  opts.chunkHeadingDepth,
	}

	switch command {
	case "corpus":
		outPath, rest, err := parseValueFlagDefault(rest, "--out", ".hev-ask/digest-input.json")
		if err != nil {
			return err
		}
		shardsDir, rest, err := parseValueFlag(rest, "--shards-dir")
		if err != nil {
			return err
		}
		shardBytesRaw, rest, err := parseValueFlag(rest, "--shard-bytes")
		if err != nil {
			return err
		}
		shardBytes := 0
		if shardBytesRaw != "" {
			if _, err := fmt.Sscanf(shardBytesRaw, "%d", &shardBytes); err != nil || shardBytes <= 0 {
				return fmt.Errorf("--shard-bytes must be a positive integer")
			}
		}
		buildOptions, rest, err = parseBuildFlags(buildOptions, rest)
		if err != nil {
			return err
		}
		if len(rest) != 0 {
			return fmt.Errorf("digest corpus got unexpected arguments: %s", strings.Join(rest, " "))
		}
		if shardsDir != "" {
			result, err := askpkg.WriteCorpusShards(buildOptions, shardsDir, shardBytes)
			if err != nil {
				return err
			}
			state := "needs-rebuild"
			if result.UpToDate {
				state = "up-to-date"
			}
			fmt.Fprintf(stdout, "[hev-ask] digest:corpus %s (%d sections, %d shards, %d pending, %s)\n",
				result.Dir, result.Sections, result.Shards, result.Pending, state)
			return nil
		}
		if shardBytesRaw != "" {
			return fmt.Errorf("--shard-bytes requires --shards-dir")
		}
		path, upToDate, sections, err := askpkg.WriteCorpusInput(buildOptions, outPath)
		if err != nil {
			return err
		}
		state := "needs-rebuild"
		if upToDate {
			state = "up-to-date"
		}
		fmt.Fprintf(stdout, "[hev-ask] digest:corpus %s (%d sections, %s)\n", path, sections, state)
		return nil
	case "assemble":
		inputPath, rest, err := parseValueFlagDefault(rest, "--input", ".hev-ask/digest-distill.json")
		if err != nil {
			return err
		}
		inputDir, rest, err := parseValueFlag(rest, "--input-dir")
		if err != nil {
			return err
		}
		buildOptions, rest, err = parseBuildFlags(buildOptions, rest)
		if err != nil {
			return err
		}
		if len(rest) != 0 {
			return fmt.Errorf("digest assemble got unexpected arguments: %s", strings.Join(rest, " "))
		}
		if inputDir != "" {
			result, err := askpkg.AssembleFromShards(buildOptions, inputDir)
			if err != nil {
				return err
			}
			if len(result.SkippedShards) > 0 {
				sample := result.SkippedShards
				suffix := ""
				if len(sample) > 8 {
					sample = sample[:8]
					suffix = ", …"
				}
				fmt.Fprintf(stdout, "[hev-ask] %d shard(s) not distilled (pending or stale): %s%s\n",
					len(result.SkippedShards), strings.Join(sample, ", "), suffix)
			}
			if len(result.Missing) > 0 {
				fmt.Fprintf(stdout, "[hev-ask] %d section(s) fell back to excerpts — distil the remaining shards and re-assemble\n", len(result.Missing))
			}
			if result.GlossaryDropped > 0 {
				fmt.Fprintf(stdout, "[hev-ask] glossary capped: %d entr(ies) dropped\n", result.GlossaryDropped)
			}
			fmt.Fprintf(stdout, "[hev-ask] digest:%s %s (%d chunks from %d shards)\n", result.Status, result.Path, result.Chunks, result.Shards)
			return nil
		}
		result, err := askpkg.AssembleFromDistillation(buildOptions, inputPath)
		if err != nil {
			return err
		}
		fmt.Fprintf(stdout, "[hev-ask] digest:%s %s (%d chunks)\n", result.Status, result.Path, result.Chunks)
		return nil
	case "status":
		shardsDir, rest, err := parseValueFlagDefault(rest, "--shards-dir", ".hev-ask/shards")
		if err != nil {
			return err
		}
		if len(rest) != 0 {
			return fmt.Errorf("digest status got unexpected arguments: %s", strings.Join(rest, " "))
		}
		result, err := askpkg.ShardStatus(".", shardsDir)
		if err != nil {
			return err
		}
		counts := map[askpkg.ShardState]int{}
		for _, shard := range result.Shards {
			counts[shard.State]++
		}
		globalState := "missing"
		if result.HasGlobal {
			globalState = "present"
		}
		upToDate := ""
		if result.UpToDate {
			upToDate = "; digest up-to-date"
		}
		fmt.Fprintf(stdout, "[hev-ask] digest:status %s — %d shards: %d distilled, %d pending, %d stale; global.json %s%s\n",
			result.Dir, len(result.Shards), counts[askpkg.ShardDistilled], counts[askpkg.ShardPending], counts[askpkg.ShardStale], globalState, upToDate)
		for _, shard := range result.Shards {
			if shard.State != askpkg.ShardDistilled {
				fmt.Fprintf(stdout, "  - %s: %s (%d sections, %dKB)\n", shard.State, shard.ID, shard.Sections, shard.Bytes/1024)
			}
		}
		return nil
	case "migrate":
		inputPath, rest, err := parseValueFlag(rest, "--input")
		if err != nil {
			return err
		}
		buildOptions, rest, err = parseBuildFlags(buildOptions, rest)
		if err != nil {
			return err
		}
		if len(rest) != 0 {
			return fmt.Errorf("digest migrate got unexpected arguments: %s", strings.Join(rest, " "))
		}
		if inputPath == "" {
			inputPath = legacyDigestPath(buildOptions.DigestPath)
		}
		result, err := askpkg.MigrateLegacyDigest(".", inputPath, buildOptions.DigestPath)
		if err != nil {
			return err
		}
		fmt.Fprintf(stdout, "[hev-ask] digest:migrated %s -> %s (%d chunks)\n", result.From, result.Path, result.Chunks)
		return nil
	case "build":
		buildOptions, rest, err = parseBuildFlags(buildOptions, rest)
		if err != nil {
			return err
		}
		digestModel, rest, err := parseValueFlagDefault(rest, "--digest-model", opts.digestModel)
		if err != nil {
			return err
		}
		provider, rest, err := parseValueFlagDefault(rest, "--provider", opts.provider)
		if err != nil {
			return err
		}
		providerURL, rest, err := parseValueFlagDefault(rest, "--provider-url", opts.providerURL)
		if err != nil {
			return err
		}
		if len(rest) != 0 {
			return fmt.Errorf("digest build got unexpected arguments: %s", strings.Join(rest, " "))
		}
		result, err := askpkg.BuildDigest(askpkg.BuildDigestOptions{
			BuildOptions:    buildOptions,
			DigestModel:     digestModel,
			Provider:        provider,
			ProviderBaseURL: providerURL,
		})
		if err != nil {
			return err
		}
		fmt.Fprintf(stdout, "[hev-ask] digest:%s %s (%d chunks)\n", result.Status, result.Path, result.Chunks)
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
			return fmt.Errorf("digest verify got unexpected arguments: %s", strings.Join(rest, " "))
		}
		result, err := askpkg.VerifyAnchors(verifyOptions)
		if err != nil {
			return err
		}
		return writeVerifyResult(stdout, result, opts.strict)
	default:
		return fmt.Errorf("unknown digest command %q", command)
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
		digest, err := askpkg.LoadDigest(opts.digestPath)
		if err != nil {
			return err
		}
		terms := askpkg.ListGlossary(digest)
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
		digest, err := askpkg.LoadDigest(opts.digestPath)
		if err != nil {
			return err
		}
		entry, ok := askpkg.GetGlossaryEntry(digest, term)
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
	digest, err := askpkg.LoadDigest(opts.digestPath)
	if err != nil {
		return err
	}
	sections := askpkg.ListSectionSummaries(digest, group)
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
	digest, err := askpkg.LoadDigest(opts.digestPath)
	if err != nil {
		return err
	}
	node, ok := askpkg.GetSection(digest, id)
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
	digest, err := askpkg.LoadDigest(opts.digestPath)
	if err != nil {
		return err
	}
	overview := askpkg.GetOverview(digest)
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
	digest, err := askpkg.LoadDigest(opts.digestPath)
	if err != nil {
		return err
	}
	response := askpkg.SearchDigest(digest, query, askpkg.SearchOptions{MaxResults: opts.maxResults})
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
	opts := options{digestPath: ".hev-ask", maxResults: 8, basePath: "/docs/", chunkHeadingDepth: 3}
	var rest []string
	for i := 0; i < len(args); i++ {
		arg := args[i]
		switch arg {
		case "--digest-dir":
			if i+1 >= len(args) {
				return opts, nil, fmt.Errorf("--digest-dir requires a value")
			}
			opts.digestPath = args[i+1]
			i++
		case "--digest-path":
			if i+1 >= len(args) {
				return opts, nil, fmt.Errorf("--digest-path requires a value")
			}
			opts.digestPath = args[i+1]
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
		case "--digest-model":
			if i+1 >= len(args) {
				return opts, nil, fmt.Errorf("--digest-model requires a value")
			}
			opts.digestModel = args[i+1]
			i++
		case "--provider":
			if i+1 >= len(args) {
				return opts, nil, fmt.Errorf("--provider requires a value")
			}
			opts.provider = args[i+1]
			i++
		case "--provider-url":
			if i+1 >= len(args) {
				return opts, nil, fmt.Errorf("--provider-url requires a value")
			}
			opts.providerURL = args[i+1]
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

func legacyDigestPath(digestPath string) string {
	if strings.EqualFold(filepath.Ext(digestPath), ".json") {
		return digestPath
	}
	return filepath.Join(digestPath, "digest.json")
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
		case "--digest-path":
			if i+1 >= len(args) {
				return options, nil, fmt.Errorf("--digest-path requires a value")
			}
			options.DigestPath = args[i+1]
			i++
		case "--digest-dir":
			if i+1 >= len(args) {
				return options, nil, fmt.Errorf("--digest-dir requires a value")
			}
			options.DigestPath = args[i+1]
			i++
		case "--content-glob":
			if i+1 >= len(args) {
				return options, nil, fmt.Errorf("--content-glob requires a value")
			}
			options.DigestContentGlobs = append(options.DigestContentGlobs, args[i+1])
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
		case "--digest-model": // parsed by digest build after common build flags
			rest = append(rest, "--digest-model")
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

func writeSection(w io.Writer, node askpkg.DigestNode) {
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
	for _, treeErr := range result.TreeErrors {
		fmt.Fprintf(w, "[hev-ask] digest tree integrity: %s\n", treeErr)
		failed = true
	}
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
		fmt.Fprintf(w, "[hev-ask] %d section(s) missing from the digest: %s%s — run `ask digest build`.\n", len(result.Uncovered), strings.Join(sample, ", "), more)
		if strict {
			failed = true
		}
	}
	if len(result.Dropped) > 0 {
		fmt.Fprintf(w, "[hev-ask] %d source literal(s) dropped from agent-primary nodes — run `ask digest build`:\n", len(result.Dropped))
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
  ask [--digest-dir .hev-ask] [--endpoint URL] [--json] <command>

Commands:
  tree
  ls [path]
  head <path>
  cat <path>
  facts <path>
  grep <query>
  digest build [--digest-model model] [--provider anthropic|openai|openrouter] [--provider-url url]
  digest corpus [--out path | --shards-dir dir [--shard-bytes n]]
  digest assemble [--input path | --input-dir dir]
  digest verify [--skip-build] [--strict]
  digest status [--shards-dir dir]
  digest migrate
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
