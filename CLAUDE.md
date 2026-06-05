# hev ask — Agent Guide

hev ask is a `⌘K` search overlay for **Astro docs sites**, shipped as the npm
package `@hevmind/ask`. This file is for agents doing engineering, docs, and
release work in this repo. Keep it practical and current.

## What this is

`@hevmind/ask` is an Astro integration. A consumer site adds `hevAsk()` to
`astro.config`, drops `SearchOverlay.astro` in a layout, and gets two search
paths over its content collection:

- **Keyword (instant, keyless):** debounced token-overlap search over
  heading-level chunks, widened by a glossary. Results deep-link to
  `/docs/page#anchor`.
- **Agentic (on Enter, needs `ANTHROPIC_API_KEY`):** a bounded Claude tool-use
  loop that issues its own `search` sub-queries, then streams a grounded answer
  (SSE) with inline deep links to the doc sections it drew from.

A committed, offline-built **ask digest** (`.hev-ask/digest.json`) gives the loop
domain context and a glossary. It was called the knowledge graph (`kg`) before
0.1; the rename is complete — the CLI group is `ask digest`, the flag is
`--digest-path`, the virtual module is `virtual:hev-ask/digest`. Don't
reintroduce `kg` names or say "knowledge graph" in new code or copy (glossary
aliases and old-URL redirects are the only places it remains on purpose).

## Repo layout

```
packages/ui    # the package @hevmind/ask — integration, endpoint, search, digest/, CLI
playground     # minimal Astro site for fast local dev of the package
site           # the public docs + showcase site (askhev.com); dogfoods @hevmind/ask
```

It's a pnpm workspace. `packages/ui` is the only published artifact; `playground`
and `site` are private consumers.

## The audience (informs everything we write)

The reader is an **Astro author evaluating search for a docs site**. Their
questions, in order, are: *What is this and why over Pagefind/Algolia/Orama? How
does it work? What can't it do? What am I trading off? How do I add it in five
minutes? What's the full API?* The docs nav (`site/src/lib/docs.ts`) is
structured to answer them in that order: Overview (Introduction, Quick start,
Concepts, Tradeoffs, Limits) then API reference.

Docs-first is the working principle: when changing the package's public
surface, update the docs in `site/src/content/docs/` in the same change. The
docs are also the search corpus, so doc edits are product edits.

## Key facts that are easy to get wrong

- **Corpus = configured content collection(s) only.** No crawler, no external
  index, no non-collection pages.
- **Anchors come from `github-slugger`** (the one non-Astro dependency) to match
  Astro's rendered `id`s byte-for-byte. `ask digest verify` is the CI gate that
  catches drift — keep it green.
- **The digest is committed JSON, hash-gated.** `ask digest build` skips the
  model call when the content hash is unchanged. Regenerate and commit after
  content changes. It's reviewable on purpose.
- **Everything degrades, nothing hard-fails:** no key at runtime → keyword
  mode; no key at build → keep committed digest and warn; no `digest.json` →
  empty digest.
- **The endpoint renders on demand** (`prerender: false`), so consumers need a
  server/hybrid adapter. A static-only build can't serve search.
- **Default models:** loop = `claude-haiku-4-5`, digest build = `claude-opus-4-8`.

## Public surface (don't break without a version bump + doc update)

- Default export `hevAsk(options)` — options in `packages/ui/src/types.ts`,
  documented in `site/.../api/configuration.mdx`.
- `@hevmind/ask/components/SearchOverlay.astro` — props `endpoint`, `placeholder`,
  `debounce`; opener attribute `data-hev-ask-open`; localStorage key
  `hev-ask:mode`.
- `@hevmind/ask/endpoint` — `POST /api/ask`: keyword mode returns JSON, agentic
  mode streams SSE (`text/event-stream`). Contract in `api/endpoint.mdx`.
- `ask` bin — read verbs, `mcp`, and `digest build` / `digest verify`. Flags in
  `api/cli.mdx`.
- Virtual modules `virtual:hev-ask/config` and `virtual:hev-ask/digest`.

When any of these change, update the matching `site/src/content/docs/api/*.mdx`
page in the same PR.

## The site (askhev.com)

- Styles, layouts, and doc components are copied from `../layer/site` (the hev
  house style: dark, JetBrains Mono, `--signal` orange). Reuse them; don't
  reinvent the look. The four doc components are `Callout`, `Diagram`, `Steps`,
  `LinkGrid`.
- Content lives in `site/src/content/docs/**`. Frontmatter schema
  (`content.config.ts`): `title`, `description`, `group`, `order` — all
  required. Nav order is driven by `site/src/lib/docs.ts`, not by `order` alone.
- ASCII architecture diagrams live in `site/src/lib/diagrams.ts`.
- `/llms.txt` and `/llms-full.txt` are generated from the docs collection.
- **Hosting:** Cloudflare Pages, project `hev-ask`, account
  `ce0c7a0a6b9935ddf1a641fd32f596b5`. `pnpm --filter hev-ask-site run deploy`
  builds and `wrangler pages deploy`s (`run` is required — pnpm's built-in
  `deploy` command shadows the script). The project's production branch is
  `main`; deploying from another git branch creates only a preview, so pass
  `--branch=main` to `wrangler pages deploy` to update production (custom
  domains serve production only). The API key for the live agentic path is
  a server secret, never bundled.

## Common commands

```sh
pnpm install                          # workspace install
pnpm --filter hev-ask-site dev       # docs site on :4334
pnpm --filter hev-ask-site build     # build site (runs digest build if key present)
pnpm --filter hev-ask-site check     # astro check
pnpm test                             # package unit tests
pnpm typecheck                        # tsc across the workspace
pnpm exec ask digest build           # (from a site dir) rebuild the digest
pnpm exec ask digest verify          # (from a site dir) verify anchors
```

## Before changing the package's public API

1. Update `packages/ui/src/types.ts` and the implementation.
2. Update the matching `site/src/content/docs/api/*.mdx`.
3. `pnpm test && pnpm typecheck && pnpm --filter hev-ask-site check`.
4. If anchors or chunking changed, run `ask digest verify` on `site/`.
5. Public/breaking changes need a version bump in `packages/ui/package.json`
   (see `README.md` for publishing notes).
