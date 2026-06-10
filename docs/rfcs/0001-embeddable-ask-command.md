# RFC 0001: Docs in your CLI — the embeddable `ask` command surface

## Summary

Productize embedding an `ask` command into other CLIs as a first-class
feature of `@hevmind/ask`. The Go module `github.com/hev/ask/pkg/ask`
becomes a public, documented surface — `NewCommandGroup(opts).Run(...)`
mounts the read verbs (`glossary`, `sections`, `section`, `overview`,
`search`, `answer`, `mcp`) under any Go CLI in ~15 lines — and the npm
package gains an equivalent `@hevmind/ask/cli` export wrapping the
existing binary launcher for Node CLIs. To make that promise keepable,
`pkg/ask` shrinks to the embed contract: roughly two-thirds of today's
exported identifiers (the digest build/shard/verify machinery) move to
`internal/build` before any external Go consumer exists.

`layer ask` (in `../layer`, `apps/layer-cli`) is the flagship consumer:
`layer ask "how do I drain a function?"` streams a grounded, deep-linked
answer from the hevlayer docs via `https://hevlayer.com/api/ask`, keyless
on the user's machine. We explicitly chose built-in embedding over a
kubectl-style `layer-<verb>` plugin protocol — the feature is "ask is a
Go module for building docs into your CLI", not "layer has plugins".

Following the ethos of layer's docs-first feature contract, the docs
pages land first and settle the user-visible shape; the Go and npm
surfaces derive from the docs; the layer wiring propagates last.

## Motivation

**The pieces already exist; they are just not a product.** The `ask`
binary is pure Go with zero dependencies, `pkg/ask.CommandGroup` was
shaped for embedding, `EndpointClient` already speaks the deployed
`/api/ask` contract including SSE answer streaming, and hevlayer.com
already dogfoods `@hevmind/ask` — so a live endpoint exists for the
flagship consumer. What is missing is a commitment: a documented public
surface, a versioning promise, and a consumer proving the loop.

**The audience widens.** Today the docs are written for an Astro author
evaluating search for a docs site. Embedding adds a second reader: a
tool author whose docs live in Astro and who wants `mytool ask` in the
terminal where their users already are. Same digest, same endpoint,
third consumption surface (overlay, MCP, CLI).

**The freeze window is now.** `pkg/ask` exports ~80 identifiers; the
moment one external `go.mod` pins `github.com/hev/ask`, every one of
them is API. The build machinery (`BuildDigest`, `PlanShards`,
`WriteCorpusShards`, `VerifyAnchors`, ...) was exported for `cmd/ask`'s
convenience, not as a contract. Moving it to `internal/` is free today
and breaking tomorrow.

## Goals

- **`layer ask <question>` works out of the box** for anyone who
  installs the layer CLI — no API key, no config; agentic answers run
  on the docs site's server key.
- **A frozen, documented Go embed surface**: `CommandGroup`,
  `EndpointClient`, `ServeMCP`, the local read functions, and the
  digest/wire types — nothing else.
- **An npm equivalent** for Node CLIs: a public `@hevmind/ask/cli`
  export of the existing launcher, mountable in commander/yargs.
- **Docs settle the shape first**: an "Embed in your CLI" guide and an
  embedding API reference land on hevask.com before the code moves.
- **Offline-capable read verbs**: a consumer can `go:embed` their
  committed `digest.json` so `search`/`sections`/`glossary` work with
  no network; only `answer` needs the endpoint.

## Non-goals

- **No plugin protocol for layer.** No `layer-<verb>` PATH discovery;
  `ask` mounts as a compiled-in verb. A plugin protocol is a separate
  layer decision if it ever earns its keep.
- **No `digest build`/`verify` in the embed surface.** Building the
  digest is a docs-site build concern; consumers ship a committed
  digest or point at an endpoint. `cmd/ask` keeps those verbs.
- **No offline `answer`.** The agentic loop stays server-side; the Go
  module does not grow an Anthropic client. Everything degrades:
  no endpoint → keyword search still works.
- **No npm package split yet.** `@hevmind/ask-cli` as a separate
  lighter package is deferred; marking `astro` an optional peer
  suffices until someone complains about weight.
- **No cobra adoption in ask.** layer RFC 0025 moves layer-cli to
  cobra; `CommandGroup.Run(ctx, args, ...)` is framework-agnostic
  passthrough and mounts the same way under stdlib dispatch or cobra.

## Design

### Docs first: the pages that settle the shape

Per the docs-first contract (layer `CLAUDE.md`), these land as the
first PR, and disagreements about the surface get resolved in review
of *these pages*, not in Go code:

- **`embed.mdx` (Overview group)** — "Embed in your CLI". Written from
  the tool author's perspective: the five-minute Go path (go get,
  mount the verb, default your endpoint), the Node path, the offline
  digest option, and what your users get (`mytool ask "question"`
  streaming a cited answer). The `layer ask` example is the worked
  example.
- **`api/embedding.mdx` (API group)** — the reference: every exported
  identifier of `pkg/ask` post-freeze with signatures, the
  `CommandOptions` table, the npm `runAsk(args, options)` contract,
  and the versioning promise (git tags, npm/Go lockstep).
- **Edits to `index.mdx` and `concepts.mdx`** — present the three
  consumption surfaces (overlay, MCP, embedded CLI) so the embedding
  story is part of what ask *is*, not an appendix.
- **`site/src/lib/docs.ts`** nav entries; digest rebuild + `ask digest
  verify` in the same PR (docs are the corpus; doc edits are product
  edits).

The hevlayer-side page (`layer ask` section in layer's `cli.mdx`) lands
with the layer implementation, per layer's "docs describe the shipped
surface" rule.

### The user-visible shape

```
$ layer ask "how do I drain a function?"
  ... streamed answer with /docs deep links ...

$ layer ask search "claim leases"        # keyword, works offline
$ layer ask sections list                 # browse the digest
$ layer ask mcp                           # stdio MCP server over the docs
$ layer ask --endpoint http://localhost:4334/api/ask "..."   # override
```

- Default endpoint is compiled in by the consumer (`layer` bakes in
  `https://hevlayer.com/api/ask`); `--endpoint` and a consumer-chosen
  env var (`LAYER_ASK_ENDPOINT`) override it.
- Bare arguments that are not a known verb are treated as a question:
  routed to `answer` when an endpoint is configured, degraded to
  `search` when not. The verb list stays in ask; consumers never
  duplicate it.
- `--help` prints usage under the consumer's name (`layer ask search
  <query>`, not `<command>`).

### The Go surface after the freeze

The audit (2026-06-07) found the runtime/build split already clean at
file granularity: no runtime file references a build helper. The freeze
is a move, not a refactor.

**`pkg/ask` keeps (~28 identifiers — this is the contract):**

| File | Kept | Role |
| --- | --- | --- |
| `command.go` | `CommandOptions`, `CommandGroup`, `NewCommandGroup`, `(CommandGroup).Run` | the verb group consumers mount |
| `endpoint.go` | `EndpointClient`, `NewEndpointClient`, 7 read/stream methods, `AnswerEvent` | programmatic client for a deployed `/api/ask` |
| `mcp.go` | `MCPOptions`, `ServeMCP` | stdio MCP server (7 read tools) |
| `local.go` | `LoadDigest` (+ new `ParseDigest`) | load a committed/embedded digest |
| `read.go` | `ListGlossary`, `GetGlossaryEntry`, `ListSectionSummaries`, `GetSection`, `GetOverview`, `Overview` | offline twins of the endpoint reads |
| `search.go` | `SearchDigest`, `SearchOptions` | keyless local search |
| `types.go` | `Digest`, `DigestNode`, `DigestEdge`, `Fact`, `SourceRef`, `GlossaryEntry`, `SectionSummary`, `KeywordResult`, `KeywordResponse` | appear in kept signatures |

**Moves to `internal/build` (~52 identifiers, with their tests):**
everything in `build.go`, `build_model.go`, `chunk.go`, `facts.go`,
`frontmatter.go`, `shard.go`, `verify.go` — corpus building, chunking,
fact extraction, shard planning/assembly, anchor verification, the
Anthropic build call. `internal/build` imports `pkg/ask` for the shared
types (`Digest`, `DigestNode`, `Fact`, ...); the dependency is one
direction, no cycle. `cmd/ask` imports both and its CLI surface is
unchanged — `digest build`/`verify`/`corpus`/`assemble`/`status` keep
working, and the build-digest skill shells the CLI so it never notices.

### Additions to `CommandOptions` (additive, settled by the docs PR)

```go
type CommandOptions struct {
    DigestPath string
    Digest     *Digest // pre-loaded (e.g. go:embed + ParseDigest); wins over DigestPath
    Endpoint   string
    JSONOutput bool
    MaxResults int

    ProgramName      string // "layer ask" — usage/help text prefix
    QuestionFallback bool   // bare non-verb args → answer (or search w/o endpoint)
}
```

- **`ProgramName`** threads into `writeCommandUsage` and error strings
  so `layer ask --help` reads as layer's own command.
- **`QuestionFallback`** is opt-in: when the first non-flag arg is not
  a known verb, the whole arg list becomes the query. With an endpoint
  it streams `answer`; without one it degrades to `search`. The
  standalone `ask` bin turns it on too (`ask "how do anchors work?"`).
- **`Digest` + `ParseDigest([]byte) (Digest, error)`** enable the
  offline story: `//go:embed digest.json` in the consumer, parse once,
  read verbs work on a plane. `MCPOptions` gains the same field.

### The npm equivalent

`bin/ask-launcher.mjs` already exports `runAsk(args, options)` and the
platform binaries already arrive via `optionalDependencies`. The change
is to make it a public, documented entry:

- `package.json` `exports` gains `"./cli"` pointing at the launcher
  (or a thin wrapper module documenting the options).
- `runAsk(args, { endpoint, digestPath, env })` — `endpoint` and
  `digestPath` inject the corresponding flag when the caller's args
  don't already carry it (safe: `CommandGroup` flags are
  position-independent).
- `peerDependenciesMeta: { astro: { optional: true } }` so a Node CLI
  depending on `@hevmind/ask` for the launcher alone does not install
  Astro.

A commander mount is the documented example:

```js
import { runAsk } from "@hevmind/ask/cli";
program.command("ask", { hidden: false })
  .allowUnknownOption()
  .action(async (_, cmd) => {
    process.exitCode = await runAsk(cmd.args, {
      endpoint: "https://docs.example.com/api/ask",
    });
  });
```

### Versioning and tagging

Go consumers resolve `github.com/hev/ask` via git tags; npm consumers
via the registry. The two ride the same tag: `packages/ui/package.json`
version and the repo tag stay in lockstep (`v0.1.1` already does this).
This RFC ships as **v0.2.0** — additive API plus the (pre-consumer,
therefore free) internalization of the build machinery. After v0.2.0,
anything exported from `pkg/ask` follows the public-surface rule in
`CLAUDE.md`: doc update and version bump in the same change.

### The flagship: `layer ask`

In `../layer` `apps/layer-cli` (its own RFC-numbered change in layer's
`docs/rfcs/` if review is wanted; the shape is small):

- go directive 1.24 → 1.25 (ask's module requires 1.25);
  `go get github.com/hev/ask@v0.2.0`.
- `case "ask":` in the dispatch → `ask.NewCommandGroup(ask.CommandOptions{
  Endpoint: askEndpoint, ProgramName: "layer ask", QuestionFallback:
  true}).Run(ctx, args[1:], stdin, stdout, stderr)` where `askEndpoint`
  defaults to `https://hevlayer.com/api/ask` and `LAYER_ASK_ENDPOINT`
  overrides.
- Usage text gains one line; dispatch test gains one case.
- Optionally `go:embed` layer's committed digest for offline search —
  the showcase for the `Digest` option.
- When RFC 0025 lands cobra, the same `Run` mounts under a cobra
  command with `DisableFlagParsing: true`; nothing here blocks or is
  blocked by 0025.

## Consequences

- **The exported Go surface drops from ~80 identifiers to ~28**, and
  what remains is a deliberate contract rather than an accident of
  `cmd/ask`'s convenience. The cost: build internals are no longer
  importable outside the module — which is the point.
- **ask adopts layer's RFC process**: this file creates `docs/rfcs/`
  as a sanctioned home (CLAUDE.md gains a pointer).
- **hevlayer's `/api/ask` takes CLI traffic** funded by the site's
  server key. The loop is bounded and keyword reads are model-free,
  but a Cloudflare rate limit on the route should precede shipping
  `layer ask` (tracked in layer, not here).
- **Embedding creates version-skew expectations**: `layer ask --help`
  reflects whatever ask version layer compiled against. Acceptable
  while both repos share an owner; the tag-lockstep rule keeps it
  legible.
- **The docs audience statement widens** from "Astro author evaluating
  search" to include tool authors; `CLAUDE.md`'s audience section
  should be updated when the docs PR lands.

## Migration

No external Go consumers exist; no npm export changes shape. The only
movers are in-repo: `cmd/ask` imports `internal/build` for the digest
verbs, and the moved tests go with their files. `pnpm test`,
`go test ./...`, `pnpm typecheck`, and `ask digest verify` on `site/`
are the gates, per `CLAUDE.md`.

## Sequencing

1. **Docs PR (hevask.com)** — `embed.mdx`, `api/embedding.mdx`, the
   `index.mdx`/`concepts.mdx` surface edits, nav, digest rebuild.
   Review settles the exported set, the `CommandOptions` additions,
   and the npm option names. Nothing below starts until this merges.
2. **Go freeze + additions** — move build machinery to
   `internal/build`; add `ProgramName`, `QuestionFallback`, `Digest`,
   `ParseDigest`; tests.
3. **npm export** — `./cli` entry, launcher options, optional peer;
   bump to 0.2.0; tag `v0.2.0`.
4. **layer wiring** — go bump, dependency, dispatch case, layer
   `cli.mdx` section; SSE-through-Cloudflare sanity check from a
   non-browser client; rate limit on `/api/ask`.

Steps 2 and 3 are one release; step 4 follows in the layer repo.

## Open questions

- **Typo'd verbs under `QuestionFallback`**: `layer ask glosary list`
  becomes a question instead of an error. Is that acceptable UX, or
  should single-bare-token args still error with a "did you mean"
  while multi-word/quoted input falls through to `answer`?
- **Local read functions: keep or trim?** This RFC keeps them (the
  offline story depends on them and they are small, pure functions
  over `Digest`). The alternative — freeze only `CommandGroup` +
  `EndpointClient` and hide local reads — shrinks the contract but
  kills `go:embed` search.
- **Does `layer ask` ship offline search in its first cut**, or
  endpoint-only with the embedded digest as a follow-up?
- **MCP server identity**: `ServeMCP` reports `"hev-ask"`; should it
  take `ProgramName` so an embedded server introduces itself as the
  host tool?

## References

- `../layer/docs/rfcs/0023-go-client-and-layer-cli.md` — layer CLI
  shape, env conventions, distribution stance.
- `../layer/docs/rfcs/0025-layer-cli-env-config-tui.md` — cobra
  restructure and config home `layer ask` must coexist with.
- `../layer/CLAUDE.md` — the docs-first feature contract and the
  documentation-homes rule this repo adopts here.
- `CLAUDE.md` — ask's public-surface rules; the audience statement.
- `pkg/ask/command.go`, `pkg/ask/endpoint.go` — the surface being
  frozen; `cmd/ask/main.go` — the only current consumer.
- `site/src/content/docs/api/cli.mdx` — the standalone CLI reference
  that gains `QuestionFallback` behavior.
