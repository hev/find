# hev ask v3 — CLI-first, agent-accessible docs

Status: **implemented in this branch**. The docs-first artifacts, HTTP read API,
OpenAPI spec, Go consumer CLI/library slice, deterministic Go
`kg corpus`/`kg assemble`, model-backed Go `kg build`, Go `kg verify`, npm
launcher bins with optional platform package manifests, deprecated alias
forwarding, MCP server, embeddable command group, and Astro build cutover exist.

This builds on the v2 design in [`PLAN.md`](./PLAN.md). v2 introduced the committed
knowledge graph and the agentic answer loop. v3 keeps all of that and reframes the
**knowledge graph as a product surface in its own right** — something a *coding agent*
queries directly, not only a ⌘K overlay for human readers.

## The narrative (what we're building toward)

Three steps, in the reader's order:

1. **Generate a knowledge graph for your doc site** — in your coding agent (the
   bundled Claude Code skill, no key) or with the `ask` CLI (`ask kg build`).
2. **Your coding agent queries your docs through the `ask` CLI** — `ask glossary`,
   `ask sections`, `ask section get`, `ask search`, `ask answer`. Keyless, offline,
   reads the committed `kg.json`.
3. **Integrate `ask` into your own tooling** — embed the CLI/Go library in your own
   CLI, run `ask mcp` as an MCP server for any agent, or generate a client from the
   published OpenAPI spec against a deployed site.

The ⌘K overlay is now *one consumer* of the knowledge graph. The CLI, the MCP server,
and the HTTP read API are peer consumers. The KG is the shared core.

## What stays, what changes

**Stays (no behavior change):**
- The Astro integration (`hevAsk()`), `SearchOverlay.astro`, virtual modules.
- The committed, hash-gated `kg.json` and its schema (`packages/ui/src/kg/schema.ts`).
- The agentic answer loop and the existing `POST /api/ask` + `GET /api/ask` contract.
- The corpus → distillation → assemble seam (so the Claude Code skill keeps working).

**Changes:**
- **New CLI in Go**, named `ask`, that subsumes today's `hev-ask-kg` producer commands
  *and* adds consumer (read) verbs. `hev-ask-kg` stays as a deprecated alias for one
  minor cycle.
- **New keyless HTTP read endpoints** under `/api/ask/*` (glossary, sections), injected
  by the integration, documented by an **OpenAPI 3.1 spec**.
- **An MCP server** (`ask mcp`) exposing the read verbs + search/answer as MCP tools.
- **A Go library** (`pkg/ask`) so the verbs can be vendored into another CLI.

## Architecture

```
                         .hev-ask/kg.json  (committed, hash-gated)
                                  │
        ┌─────────────────────────┼──────────────────────────┐
        │                         │                           │
   ⌘K overlay            ask CLI / MCP server          /api/ask/* read API
 (human readers)        (coding agents, local)        (remote clients, OpenAPI)
        │                         │                           │
   POST /api/ask          reads kg.json directly        GET glossary/sections
   (keyword + agentic)    or --endpoint <url>           POST search/answer
```

The KG file is the contract. Everything reads the same `KnowledgeGraph` shape.

## The `ask` CLI (Go)

Single binary, two command groups: **producer** (`kg`) and **consumer** (everything else).

```
ask kg build        # one-shot build (needs ANTHROPIC_API_KEY)   [was: hev-ask-kg build]
ask kg corpus       # emit sections to distil (keyless)          [was: hev-ask-kg corpus]
ask kg assemble     # assemble kg.json from a distillation        [was: hev-ask-kg assemble]
ask kg verify       # anchors / coverage / fidelity (CI gate)     [was: hev-ask-kg verify]

ask glossary list                 # list glossary terms (+aliases)
ask glossary get <term>           # one entry, matched by term or alias
ask sections list [--group G]     # list section nodes (id, title, heading, group, url)
ask section get <id>              # one node: summary, facts, sources, url
ask overview                      # the deterministic grouped map + context

ask search <query>                # keyword prefilter, keyless, ranked results
ask answer <query>                # agentic loop; needs key (local) or --endpoint

ask mcp                           # run the MCP server (stdio) over the above
```

Global flags: `--kg-path` (default `.hev-ask/kg.json`), `--endpoint <url>`,
`--json` (machine output; default for non-TTY), `--collection`, `--base-path`,
`--content-glob`, `--chunk-heading-depth`. Producer flags match today's `hev-ask-kg`
exactly (see `api/cli.mdx`) so the migration is a rename.

### Data sources for read verbs

Default: **read the committed `kg.json` directly** — works offline, no server, ideal for
an agent in a checked-out repo. `--endpoint <url>` switches to the HTTP read API for a
deployed site (freshest graph; only path that can stream `answer`). Resolution order:
explicit `--endpoint` → `--kg-path` → `./.hev-ask/kg.json`. `answer` without a key and
without `--endpoint` errors with a clear message pointing at both options.

### Distribution

- **npm (primary, matches the audience):** ship prebuilt platform binaries as
  `optionalDependencies` (the esbuild/turbo model) with a thin JS launcher in `@hev/ask`,
  so `pnpm add @hev/ask` keeps "just working" and the integration can shell out to the
  resolved binary.
- **`go install github.com/hev/ask/cmd/ask@latest`** for Go users.
- GitHub Releases (+ Homebrew tap later) for standalone use.

### The parity risk (the one thing that can go wrong)

Today `chunk.ts` is shared by **both** the producer (build) and the **runtime endpoint**
(`endpoint.ts` → `buildIndex` re-chunks the collection at request time). Chunk IDs,
cleaned text, and the content hash must agree byte-for-byte, because:

- KG node ids (`slug#anchor`) come from `github-slugger`, and `kg verify` checks them
  against the *actually rendered* Astro HTML — this is the deep-link contract.
- The runtime recomputes the content hash in TS (`warnIfStale`) and compares it to the
  hash Go wrote into `kg.json`. Any divergence fires false "stale graph" warnings.

A Go build must reproduce, exactly: heading detection (`HEADING_RE`), `cleanHeadingText`
+ `cleanMarkdown`, **`github-slugger`** (unicode handling, emoji stripping, the `-1`/`-2`
de-dup counters), `docSlugToUrl`, the chunk-id rule, `hashableChunkText` ordering, and
`sha256`.

**Mitigation (v3, recommended): golden parity test.** Generate a fixture corpus +
expected outputs (slugs, chunk ids, cleaned text, content hash) from the *current TS
implementation*, commit it, and run it in Go CI. The TS impl stays the oracle; the Go
port must match it. `kg verify` against rendered HTML remains the end-to-end backstop.

**Future simplification (noted, not v3): artifact-driven runtime.** Make the Go CLI the
*single* chunker and have the runtime consume a committed index instead of re-chunking.
That deletes the dual-implementation surface entirely, at the cost of a larger committed
artifact (per-chunk tokens for keyword search). Revisit once the Go port is proven.

## HTTP read API + OpenAPI

New **keyless** routes, served from the runtime KG (`virtual:hev-ask/kg`), injected by
the integration alongside the existing `/api/ask`:

| Method & path | Returns |
|---|---|
| `GET /api/ask` | suggestions + model *(exists)* |
| `POST /api/ask` | keyword JSON / agentic SSE *(exists)* |
| `GET /api/ask/glossary` | `{ terms: GlossaryEntry[] }` |
| `GET /api/ask/glossary/{term}` | one `GlossaryEntry` (term or alias) |
| `GET /api/ask/sections` | `{ sections: SectionSummary[] }` (id, title, heading, group, url) |
| `GET /api/ask/sections/{id}` | one full `KnowledgeNode` |
| `GET /api/ask/overview` | `{ overview, context }` |

Routing: the integration injects `${endpoint}/[...resource]` (entrypoint
`@hev/ask/endpoint`) so all read routes share one handler that dispatches on the path —
keeping the single-entrypoint injection pattern that's there today. Sub-routes are
keyless and side-effect-free, so they're safe on any adapter.

The OpenAPI 3.1 spec is the contract for all of `/api/ask*`. Canonical source lives in
the package (`packages/ui/openapi.yaml`); the site serves it at
`https://askhev.com/openapi.yaml` for client generation, and `api/endpoint.mdx` links
to it. The `ask` CLI's `--endpoint` client is generated from / validated against the
same spec.

## MCP server (`ask mcp`)

Stdio MCP server wrapping the read verbs + search/answer as tools:
`glossary_list`, `glossary_get`, `sections_list`, `section_get`, `overview`,
`search`, `answer`. Same data-source resolution as the CLI (local `kg.json` by default,
`--endpoint` for remote). This is the drop-in path for Claude Code / any MCP client —
"point your agent at the docs" with zero glue. Documented as a new
`api/mcp.mdx` page.

## Embeddable Go library (`pkg/ask`)

The read/search operations live in an importable Go package with a stable surface, plus a
mountable `cobra` command group, so a consumer can `import` it and add `myteam-cli docs
glossary ...` to their own tool. This is bullet #3. Documented in `api/cli.mdx` (Library
section) once it exists.

## Migration & compatibility

- `hev-ask-kg` bin name retained for one minor version as an alias that forwards to
  `ask kg …` and prints a one-line deprecation notice.
- `kg build/corpus/assemble/verify` flags and outputs are byte-compatible — existing CI
  and `package.json` scripts keep working after the rename.
- No `kg.json` schema change in v3; the read API/CLI are pure consumers of the v2 graph.

## Sequencing

1. **Docs-first (this session):** rewrite the Introduction around the three bullets;
   write the OpenAPI 3.1 spec for the target `/api/ask*` surface; this plan.
2. **HTTP read API:** implement the `/api/ask/*` read routes in the TS endpoint +
   integration route injection; validate against the OpenAPI spec; add `api/endpoint.mdx`
   + `api/mcp.mdx` doc updates. **Done.**
3. **Go CLI — consumer first:** `ask glossary|sections|section|overview|search` reading
   local `kg.json`, plus `--endpoint` client. Lowest risk (pure reads), delivers bullet #2.
   **Done.**
4. **Go CLI — producer:** port `kg build|corpus|assemble|verify` with the golden parity
   test green in CI; wire npm distribution + the deprecated `hev-ask-kg` alias.
   **Done for `corpus`/`assemble` with corpus and assemble parity checks, and
   `verify` with anchor/coverage/fidelity checks; model-backed `build` is ported
   with fake-client tests and hash-gated skip smoke checks; npm launcher bins,
   platform binary packages, and alias forwarding are wired.**
5. **MCP server + Go library:** `ask mcp` and `pkg/ask`; bullet #3. **Done.**
6. **Cutover:** integration shells out to the Go binary for `astro:build:start`; retire
   the in-process TS build path once parity is proven. **Done for the build hook.**

## Open items (reversible defaults taken)

- **Binary name `ask`** — generic and PATH-collision-prone. Default to `ask` per your
  spec; fall back to `hev-ask` (with an `ask` alias) if collisions bite. Reversible.
- **Where the intro stops claiming present-tense** — the rewritten intro describes the
  *target* experience. Don't deploy it to askhev.com until the CLI consumer verbs ship
  (step 3), or gate the agent-access section behind a "coming in v3" note.
