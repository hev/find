# RFC 0004: Beyond Astro — the host-neutral overlay, a static keyword bundle, and a hostable endpoint

## Summary

Finish the decoupling the last three RFCs started and make hev ask **host-neutral
in fact, not just at the core.** Today the build, the digest, the slugger, the
CLI, and MCP are already framework-agnostic (RFC 0001 froze the Go core; 0002
made the digest a filesystem; 0003 made MCP a hydrate-and-read tool). What is
still Astro-bound is the *delivery*: keyword search runs server-side through the
Astro `/api/ask` route, the overlay lives inside `SearchOverlay.astro`, and the
endpoint is an Astro `APIRoute` that calls `getCollection`. This RFC extracts
three host-neutral primitives from that glue so that **Astro becomes one adapter
over a shared core rather than the substrate**:

1. **A client-side keyword overlay.** Keyword retrieval moves into the browser,
   over a prebuilt static index. A new `ask digest bundle` verb emits that index
   (plus glossary, suggestions, and title-tree) from the committed `.hev-ask/`
   tree. The overlay ships as a prebuilt web component, `@hevmind/ask/overlay`,
   configured by data attributes. Result: **keyword search needs no server on any
   host** — including a static Astro build.
2. **A hostable agentic endpoint.** The bounded answer loop becomes a
   host-agnostic `handleAsk(request, { digest, env })` handler with deploy
   targets — Cloudflare Worker, Node, Vercel — scaffolded by `ask endpoint init
   --target`. The Astro route becomes a thin wrapper over the same handler.
3. **Per-adapter slug schemes.** Anchor generation grows a small scheme
   interface — `github-slugger` stays the default (Astro, GitHub); a Docusaurus
   scheme honors explicit `{#custom-id}` headings — and `ask digest verify`
   checks anchors against whatever directory the framework builds.

With those three in place, **Docusaurus, VitePress, MkDocs, and plain HTML need
no special hev-ask code** — each is "build the digest, bundle the assets, drop in
the `<script>`, optionally point at an endpoint." The Astro integration keeps its
batteries-included DX by automating exactly those steps.

Per the docs-first contract (RFC 0001), the user-visible shape is settled in the
docs first: the **Frameworks** page, the host-neutral edits to Concepts /
Tradeoffs / Limits, and the repositioned hero already landed (working-backward,
undeployed). This RFC is the build plan that makes them true. **Nothing on
hevask.com deploys until the primitives ship.**

## Motivation

**The decoupling is 80% done; the last 20% is what users see.** The audit behind
RFC 0001 found the runtime/build split clean at file granularity, and the Go core
carries zero Astro imports. The remaining Astro coupling is concentrated in four
places: `integration.ts` (100% Astro plugin glue), the `getCollection` call that
builds the runtime keyword index, `SearchOverlay.astro`'s ~15-line wrapper around
a ~1,350-line vanilla `HevAskOverlay` class, and the `APIRoute` shape of
`endpoint.ts`. None of that coupling is essential — it is where the portable
logic happens to be *mounted*, not what it depends on.

**Keyword-on-the-server is the load-bearing accident.** The single fact that
forces every consumer onto a server adapter is that keyword search currently
POSTs to `/api/ask` and is answered by `buildIndex()` over `getCollection`.
Nothing about token-overlap-plus-glossary needs a server: the index is bounded,
the scoring is pure, and the chunking already runs in TypeScript. Moving keyword
retrieval to the client over a static index removes the server requirement for
the common case and, not incidentally, makes keyword search work on a fully
static Astro build too — something it cannot do today.

**The agentic endpoint is already nearly portable.** `endpoint.ts`'s request
parsing, SSE streaming (Web Streams), and environment resolution already handle
both Cloudflare Workers and Node adapters. The only Astro-specific surfaces are
the `APIRoute` signature and the `getCollection`-fed index. Lift those and the
loop is a standard `Request → Response` handler any runtime can host.

**The audience already widened.** RFC 0001 added the tool author to "Astro author
evaluating search." This RFC adds the **author on another framework** — the
Docusaurus or VitePress maintainer who wants the same deep-linked, agent-readable
search without migrating their site. The product was never "search for Astro"; it
was "your docs as a digest, read many ways." Astro was the first delivery, not
the definition.

## Goals

- **Keyword search runs client-side, statically, on any host.** A prebuilt index
  + the bundled overlay answer keyword queries in the browser with no server and
  no key — including on a static Astro build.
- **One distillation, one search implementation, every framework.** No
  per-framework fork of chunking, scoring, or the glossary. Adapters are config +
  the bundle step + a script tag.
- **A prebuilt overlay package** — `@hevmind/ask/overlay`, a framework-neutral
  web component — that `SearchOverlay.astro` and every other framework both
  consume. One overlay, many mounts.
- **A hostable endpoint** — `handleAsk()` plus `ask endpoint init --target
  {cloudflare,node,vercel}` — serving the existing `POST /api/ask` contract,
  decoupled from Astro's route mechanism.
- **Per-adapter slug schemes** with the default unchanged (`github-slugger`), a
  Docusaurus scheme, and `ask digest verify` generalized to any build directory.
- **Documented recipes** for Docusaurus, VitePress, MkDocs, and plain HTML that a
  maintainer can follow without reading hev ask's internals — already drafted on
  the Frameworks page; this RFC makes them executable.

## Non-goals

- **No new retrieval quality.** This is a delivery refactor, not a recall change:
  same token-overlap-plus-glossary scoring, same bounded loop, same models.
  Embeddings remain the separately-deferred upgrade (see Limits).
- **No framework plugins we must maintain forever.** The first-class artifact is
  the host-neutral overlay + endpoint. A published Docusaurus *plugin* or
  VitePress *theme helper* is a thin optional convenience, not a commitment to
  track every framework's release cycle. `mountHevAsk` is the helper ceiling.
- **No server-side keyword as the default.** Large corpora may still want a
  server-side keyword path (see Open questions), but the default and the
  documented path become client-side static. We do not maintain two equal
  keyword surfaces by design.
- **No change to the digest *format*.** RFC 0002's section tree is the input to
  `ask digest bundle`; the bundle is a derived, build-time artifact (like
  `dist/`), not a second committed source of truth.
- **No SSR for the overlay.** The overlay is a client web component everywhere;
  the Astro adapter does not server-render it. (It already doesn't.)

## Design

### Docs first: the shape is already settled

Per RFC 0001's contract, these landed before any code (working-backward,
undeployed): the **Frameworks** page (`site/.../frameworks.mdx`), the
host-neutral section in **Concepts**, the adapter tradeoff in **Tradeoffs**, the
generalized **Limits**, the repositioned hero and Introduction, and the nav entry
in `docs.ts`. They define the user-visible contract this RFC implements:

- the overlay script tag and its `data-hev-ask-digest` / `data-hev-ask-endpoint`
  attributes;
- the `ask digest bundle --out <dir>` verb;
- the `ask endpoint init --target <runtime>` verb and the standalone endpoint;
- the per-framework recipes and the support matrix.

Disagreements about the surface get resolved by editing those pages, not the Go
or TS code. CLAUDE.md is updated to mark non-Astro adapters as in-design.

### Primitive 1 — the client-side keyword overlay

**Extract the overlay.** `HevAskOverlay` (the ~1,350-line vanilla class) moves out
of `SearchOverlay.astro` into a standalone, framework-neutral module built to
`@hevmind/ask/overlay` (ESM, custom-element registration + a `mountHevAsk(opts)`
export). `SearchOverlay.astro` becomes the Astro *wrapper*: it renders the script
tag and an opener and passes props through as data attributes. Identical DX on
Astro; the same class everywhere else.

**Move keyword retrieval to the client.** The chunking (`chunk.ts`), glossary
expansion, and token-overlap scoring already live in pure TypeScript. They are
bundled into the overlay and run over a static index fetched from
`data-hev-ask-digest`. The overlay no longer POSTs to `/api/ask` for keyword
results; it only calls the endpoint for *agentic* answers, and only when
`data-hev-ask-endpoint` is set.

**Bundle the index.** A new Go verb (host-neutral, sits beside the RFC 0002 read
verbs):

```
ask digest bundle --out <static-dir>/hev-ask
```

reads the committed `.hev-ask/` tree and emits the browser payload:

- `index.json` — the keyword index (per-section title, summary, terms, facts,
  url+anchor) the client scores against;
- `glossary.json` — aliases + terms for query expansion;
- `meta.json` — suggestions, orientation context, content hash;
- `tree.json` — the title-tree (rung 0) for instant render.

These are derived build artifacts. The Astro integration runs `bundle`
automatically into the build output; other frameworks run it in their build
script (`ask digest bundle --out static/hev-ask && docusaurus build`). Crucially
the bundle is **gitignored build output, never committed** — regenerated on every
build like rendered HTML — so it has no staleness surface of its own: it tracks
your content exactly as your `dist/` does. The committed `.hev-ask/` tree stays
the single reviewable source of truth (RFC 0002); the bundle is just its
browser-shaped projection.

**Astro behavior change (called out):** on Astro, keyword search becomes
client-side too. Upside — keyword search now works on a *static* Astro build, and
`/api/ask` is needed only for agentic answers. The runtime `getCollection`-based
index path is removed; the integration emits the static bundle instead. This is
the one intentional behavior change for existing Astro consumers and the reason
this ships as a minor (see Migration).

### Primitive 2 — the hostable endpoint

**Lift the handler.** The portable core of `endpoint.ts` becomes:

```ts
handleAsk(request: Request, { digest, env }: AskContext): Promise<Response>
```

— standard `Request`/`Response`, SSE via Web Streams, env resolution as today
(already Cloudflare- and Node-aware). It reads the committed digest tree (or an
embedded copy) rather than `getCollection`. The Astro `APIRoute` shrinks to:

```ts
export const POST: APIRoute = ({ request, locals }) =>
  handleAsk(request, { digest: loadDigest(), env: locals.runtime?.env ?? process.env });
```

**Scaffold the deploy targets.** A CLI verb on `cmd/ask` (not in the frozen
embed surface; this is a build/deploy concern, like `digest build`):

```
ask endpoint init --target {cloudflare,node,vercel}
```

writes a minimal project that imports `handleAsk`, loads the committed digest,
and serves `POST /api/ask` — Worker, Node `http` server, or Vercel function. The
key lives as a server secret; the digest is read from disk or vendored. One
endpoint can serve many sites' overlays.

**The wire contract is unchanged.** It is the same `POST /api/ask` (JSON keyword
fallback + SSE answer) that `EndpointClient` and the CLI already speak (RFC 0001),
so `layer ask`, MCP-over-endpoint, and the overlay all keep working.

### Primitive 3 — per-adapter slug schemes

Anchor generation grows a tiny interface in both the Go core and the TS chunker:

```
type SlugScheme interface { Slug(heading string) string }
```

- **default** — `github-slugger` semantics (Astro, GitHub, VitePress). Unchanged
  output for every existing consumer.
- **docusaurus** — github-slugger plus explicit `{#custom-id}` heading override
  parsing.

The adapter selects the scheme; the digest records which scheme produced its
anchors. `ask digest verify` is generalized from a hard-coded `dist/` to a
`--build-dir` (default per adapter: Astro `dist/`, Docusaurus `build/`, VitePress
`.vitepress/dist/`, MkDocs `site/`), and still fails if any chunk anchor is
missing from the rendered HTML. The CI gate stays green per framework.

### What an "adapter" actually is

After the three primitives, a framework adapter is small:

| Adapter | Build hook | Overlay mount | Endpoint | Net new code |
| --- | --- | --- | --- | --- |
| Astro | integration runs `bundle` | `SearchOverlay.astro` wrapper | mounted route via `handleAsk` | the wrapper + integration glue (exists) |
| Docusaurus | `bundle` in build script | `scripts:` entry | hostable endpoint | docs only (+ optional plugin) |
| VitePress | `bundle` in build script | theme `mountHevAsk` | hostable endpoint | docs only (+ optional helper) |
| MkDocs | `bundle` in build script | `extra_javascript` | hostable endpoint | docs only |
| Static / HTML | `bundle` in CI | `<script>` tag | hostable endpoint | docs only |

The point of the RFC: the only adapter that needs *code* is the one that already
exists. The rest are configuration over shared primitives.

## Consequences

- **Keyword search stops requiring a server**, removing the single biggest
  adoption barrier for static hosts and making keyword work on static Astro
  builds. The cost is a client-side index download, bounded by corpus size (see
  Open questions for the large-corpus tail).
- **`/api/ask` becomes agentic-only.** Simpler contract, smaller server
  responsibility, and the endpoint is now independently deployable and shareable
  across sites.
- **One overlay, one search implementation** to maintain instead of an Astro
  component plus hypothetical per-framework reimplementations. The overlay
  becomes a published, versioned artifact (`@hevmind/ask/overlay`) with its own
  size budget.
- **The published surface grows** by the overlay export, `handleAsk`, the bundle
  artifact schema, and two CLI verbs (`digest bundle`, `endpoint init`) — each
  now under the public-surface rule (doc + version bump on change).
- **More deploy documentation to own.** Three endpoint targets and four framework
  recipes are real maintenance; the matrix in Frameworks is the honest scope.
- **CLAUDE.md's audience widens again** to non-Astro framework authors; the
  host-neutral framing is now the headline rather than a footnote.

## Migration

- **Existing Astro consumers:** one intentional change — keyword search moves
  client-side and the integration now emits a static bundle into the build
  output. Consumers who relied on the server-side keyword JSON from `/api/ask`
  (undocumented as a standalone) should switch to the overlay. The agentic
  contract is unchanged. Ships as **v0.3.0** (minor: additive primitives + one
  behavior change with a clear upgrade note), following the 0.2.0 of RFC 0001.
- **Digest format:** unchanged (RFC 0002 tree). `bundle` is additive and derived;
  no re-distillation, no re-commit required beyond a normal rebuild.
- **Slugger:** default scheme is byte-identical to today; no anchor churn for
  existing sites. Only opting into `docusaurus` mode changes anchors, and only
  for that adapter.
- **Gates:** `pnpm test`, `go test ./...`, `pnpm typecheck`, `pnpm --filter
  hev-ask-site check`, and `ask digest verify` on `site/` — plus a new overlay
  bundle-size check and a `handleAsk` contract test exercised against the Node
  target.

## Sequencing

1. **Docs PR (done, undeployed).** Frameworks page, host-neutral edits across
   Overview, hero/README/CLAUDE.md, nav. Settles the surface. *This is the merged
   working-backward artifact this RFC plans against.*
2. **Bundle + client keyword.** `ask digest bundle`; bundle the chunk/score/
   glossary logic into a client path; extract `HevAskOverlay` to
   `@hevmind/ask/overlay`; reduce `SearchOverlay.astro` to a wrapper; switch the
   Astro integration to emit the bundle. Keyword works static end-to-end on the
   playground built with no adapter.
3. **Hostable endpoint.** Extract `handleAsk`; rewrite the Astro route as a
   wrapper; `ask endpoint init` for the three targets; contract test. Agentic
   answers work from a deployed standalone endpoint pointed at by the overlay.
4. **Slug schemes + verify.** Scheme interface, Docusaurus scheme,
   `--build-dir`. A real Docusaurus fixture site in `examples/` proves the recipe
   and keeps `verify` green.
5. **Recipes hardened + deploy.** Walk each Frameworks recipe on a real fixture;
   fix the drift; *then* deploy hevask.com. The site stops overstating the moment
   the primitives are real.

Steps 2–4 are one release (**v0.3.0**); step 5 flips the docs from
working-backward to shipped.

## Open questions

- **Large-corpus client index.** A Cloudflare-docs-scale corpus (~25k sections)
  is a heavy client-side index. Do we ship a size threshold above which `bundle`
  emits a sharded/lazy index, or keep an opt-in server-side keyword path for big
  sites? The bounded common case (dozens–hundreds of sections) is fine; the tail
  needs a decision, and silently shipping a 5 MB index would violate the
  no-silent-truncation ethos.
- **Overlay distribution.** CDN (`jsdelivr`) vs. vendored asset vs. both? CDN is
  the lowest-friction drop-in but adds a third-party runtime dependency the
  static story otherwise avoids. Likely: document CDN, support vendoring.
- **`mountHevAsk` vs. pure custom element.** Is the imperative `mountHevAsk(opts)`
  worth shipping alongside the declarative `<script data-*>` registration, or does
  it just double the surface? VitePress's `enhanceApp` wants imperative; MkDocs
  wants declarative. Probably both, scoped tightly.
- **Endpoint targets to bless.** Cloudflare + Node cover most; is Vercel worth a
  first-class scaffold or a documented recipe? Each blessed target is ongoing
  maintenance.
- **Astro static-keyword as the new default vs. opt-in.** Do we flip Astro to the
  client bundle for everyone in 0.3.0, or gate it behind a flag for one minor to
  de-risk? Flipping is cleaner; gating is gentler. The Migration above assumes
  flipping with a release note.
- **A published Docusaurus plugin.** Docs-only is the stated ceiling, but a
  `@hevmind/docusaurus-plugin-ask` that runs `bundle` and injects the script is a
  small, high-leverage convenience. Ship it as the one exception, or hold the
  line? (Non-goal today; revisit after the recipe is proven.)

## References

- `docs/rfcs/0001-embeddable-ask-command.md` — the frozen host-neutral Go core,
  `EndpointClient`, the `/api/ask` wire contract, the docs-first contract, and
  the audience-widening this continues.
- `docs/rfcs/0002-digest-as-filesystem.md` — the section tree that `ask digest
  bundle` reads; the read-verb model the overlay's client search mirrors.
- `docs/rfcs/0003-mcp-as-hydrate.md` — "overlay = synthesis, MCP = files"; this
  RFC makes the overlay itself host-neutral while keeping that split.
- `packages/ui/src/integration.ts` — the Astro glue being reduced to a wrapper.
- `packages/ui/src/endpoint.ts`, `packages/ui/src/search/index.ts` — the
  `getCollection`/`APIRoute` coupling lifted into `handleAsk` + the static bundle.
- `packages/ui/src/components/SearchOverlay.astro` — the wrapper; its
  `HevAskOverlay` class becomes `@hevmind/ask/overlay`.
- `pkg/ask/chunk.go`, `pkg/ask/build.go` — the framework-agnostic chunker/builder
  the slug-scheme interface extends.
- `site/src/content/docs/frameworks.mdx` — the user-visible contract this RFC
  implements.
