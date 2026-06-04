# hev ask

hev ask is a ⌘K search overlay for Astro docs sites. It combines instant
keyword search over heading anchors with an optional Claude-powered search loop
that runs when the reader presses `Enter`.

- **Instant keyword path** — every typed query searches content chunks locally
  on the server; no API key is needed for this mode.
- **Anchor results** — docs are chunked by headings, so results can link to
  `/docs/page#section` instead of only the page root.
- **Agentic Enter** — Claude decides focused sub-queries, uses the keyword
  search tool, then streams a grounded answer (SSE) with inline deep links to
  the sections it drew from.
- **Knowledge graph** — an optional committed `.hev-ask/kg.json` adds domain
  context and glossary aliases for better retrieval.

## Status

The package source is ready under `packages/ui` as `@hev/ask`. It is not yet
published to npm, so consumers should use the GitHub package path until the
first npm release is cut.

The docs site is configured for `askhev.com` on Cloudflare Pages project
`hev-ask`. A live deploy and custom-domain move still require Cloudflare
credentials with access to the configured account.

## Repo layout

```
.
├─ packages/ui                    # the publishable package: @hev/ask
├─ playground                     # a minimal Astro docs site for fast local dev
├─ site                           # docs + showcase site (askhev.com)
└─ tpuff-docs-local/turbopuffer   # larger local docs corpus for scale checks
```

The `site/` directory is the public documentation site. It is written
docs-first for **Astro authors evaluating search**, and it *searches itself*
with `@hev/ask` — the docs are the product's own test corpus. Press `⌘K` on the
running site to see it work on real content.

## Develop

```sh
pnpm install
cp playground/.env.example playground/.env   # add ANTHROPIC_API_KEY for AI search/KG builds
pnpm dev
```

Open the playground and press `⌘K`.

To work on the documentation/showcase site instead:

```sh
pnpm --filter hev-ask-site dev      # runs on :4334
pnpm --filter hev-ask-site build    # static pages + the /api/ask function
pnpm --filter hev-ask-site check    # astro check (types)
```

Useful checks:

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm kg:build
pnpm kg:verify
```

## Use in a site

Install the package from npm when published:

```sh
pnpm add @hev/ask
```

Until then, consume the latest GitHub version from the package subdirectory:

```sh
pnpm add "git+ssh://git@github.com/hev/ask.git#main&path:/packages/ui"
```

```js
// astro.config.mjs
import hevAsk from '@hev/ask';

export default defineConfig({
  integrations: [
    hevAsk({
      collections: ['docs'],
      basePath: '/docs/',
      // endpoint: '/api/ask',
      // model: 'claude-haiku-4-5',
      // kgModel: 'claude-opus-4-8',
    }),
  ],
});
```

```astro
---
import SearchOverlay from '@hev/ask/components/SearchOverlay.astro';
---
<button data-hev-ask-open>Search <kbd>⌘K</kbd></button>
<SearchOverlay />
```

Set `ANTHROPIC_API_KEY` in the server environment for AI search. Without it,
the endpoint still returns keyword results.

## Knowledge Graph

The optional knowledge graph is generated offline and committed into the
consumer site:

```sh
pnpm exec ask kg build
pnpm exec ask kg verify
```

`build` writes `.hev-ask/kg.json` and skips the model call when the current
content hash already matches. `verify` builds the site and checks that every
heading chunk URL points at a real rendered anchor.

## Publishing

The package is structured for npm distribution as `@hev/ask`, with `src`
exports for Astro/Vite consumers plus `ask` and deprecated `hev-ask-kg` bins for
CLI use from `node_modules`.

Current consumers can pin the GitHub package while the API settles. Once
`@hev/ask` is published, downstream sites should depend on a normal semver
range instead of a Git SHA.

Before publishing:

1. Set the intended semver in `packages/ui/package.json`.
2. Run `pnpm build:npm-binaries` to populate the optional platform packages.
3. Run `pnpm test`, `pnpm typecheck`, `pnpm build`, and `pnpm kg:verify`.
4. Dry-run the package with `pnpm --filter @hev/ask pack --dry-run`.
4. Publish from `packages/ui` with `pnpm publish --access public`.
5. Move consumers from the Git dependency to `@hev/ask@<version>`.
