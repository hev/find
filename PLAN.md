# Architecture Notes: hev ask

hev ask is an Astro integration that adds a command-palette search overlay to
docs sites. It indexes configured Astro content collections, returns
heading-level keyword results without an API key, and can run a bounded Claude
search loop when the reader presses Enter.

## Current Shape

- `packages/ui` is the publishable package, `@hev/ask`.
- `playground` is a minimal local consumer for package development.
- `site` is the public docs/showcase site and dogfoods the package.
- `tpuff-docs-local/turbopuffer` is a local scale-test consumer with a larger
  docs corpus.

The package owns the Astro integration, injected endpoint, overlay component,
keyword index, knowledge-graph builder, and anchor verification CLI.

## Public Surface

- Default export: `hevAsk(options)`.
- Main options type: `HevAskOptions`.
- Overlay component: `@hev/ask/components/SearchOverlay.astro`.
- Endpoint helper: `@hev/ask/endpoint`, mounted by default at `/api/ask`.
- Opener attribute: `data-hev-ask-open`.
- Mode storage key: `hev-ask:mode`.
- Virtual modules: `virtual:hev-ask/config` and `virtual:hev-ask/kg`.
- CLI: `hev-ask-kg build` and `hev-ask-kg verify`.
- Knowledge-graph artifact path: `.hev-ask/kg.json`.

Any change to these names or contracts needs the package code and the docs in
`site/src/content/docs/api/` updated together.

## Search Model

Typing in the overlay runs keyword search over heading chunks. Chunks are built
from configured content collections, scored by token overlap, widened by
glossary aliases from the committed knowledge graph, and returned as direct
links to page anchors.

Pressing Enter runs the agentic path when `ANTHROPIC_API_KEY` is available. The
runtime model defaults to `claude-haiku-4-5`; it issues a small number of
focused search-tool calls, ranks the surfaced chunks, and streams grounded
results with inline links. Without a runtime key, the endpoint keeps serving
keyword results.

The optional knowledge graph is generated offline with the configured KG model,
defaulting to `claude-opus-4-8`. It is hash-gated, committed to git, and bundled
through the `virtual:hev-ask/kg` module so deployed workers do not need runtime
filesystem access.

## Anchor Correctness

Heading anchors are generated with `github-slugger` so chunk URLs match Astro's
rendered heading IDs. `hev-ask-kg verify` builds the consumer site and checks
that every generated chunk anchor exists in the rendered HTML.

Keep this verification green after changes to chunking, slug generation,
content paths, layouts, or docs frontmatter.

## Deployment Notes

The docs site is configured for Cloudflare Pages project `hev-ask` under account
`ce0c7a0a6b9935ddf1a641fd32f596b5`. The live AI path requires
`ANTHROPIC_API_KEY` as a server secret.

Deploying or moving the `ask.hev.dev` custom domain requires Cloudflare Pages
credentials with access to that account. Local builds and package verification
do not require those credentials unless a fresh remote deploy is being made.
