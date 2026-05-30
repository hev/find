# hev find

hev find is a ⌘K search overlay for Astro docs sites. It combines instant
keyword search over heading anchors with an optional Claude-powered search loop
that runs when the reader presses `Enter`.

- **Instant keyword path** — every typed query searches content chunks locally
  on the server; no API key is needed for this mode.
- **Anchor results** — docs are chunked by headings, so results can link to
  `/docs/page#section` instead of only the page root.
- **Agentic Enter** — Claude decides focused sub-queries, uses the keyword
  search tool, and presents ranked section results with one-line snippets.
- **Knowledge graph** — an optional committed `.hev-find/kg.json` adds domain
  context and glossary aliases for better retrieval.

## Repo layout

```
.
├─ packages/ui      # the published package: @hev/find
└─ playground       # a local Astro docs site that mirrors layer/site for dev
```

## Develop

```sh
pnpm install
cp playground/.env.example playground/.env   # add ANTHROPIC_API_KEY for AI search/KG builds
pnpm dev
```

Open the playground and press `⌘K`.

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
pnpm add @hev/find
```

Until then, consume the latest GitHub version from the package subdirectory:

```sh
pnpm add "git+ssh://git@github.com/hev/find.git#main&path:/packages/ui"
```

```js
// astro.config.mjs
import hevFind from '@hev/find';

export default defineConfig({
  integrations: [
    hevFind({
      collections: ['docs'],
      basePath: '/docs/',
      // endpoint: '/api/find',
      // model: 'claude-haiku-4-5',
      // kgModel: 'claude-opus-4-8',
    }),
  ],
});
```

```astro
---
import SearchOverlay from '@hev/find/components/SearchOverlay.astro';
---
<button data-hev-find-open>Search <kbd>⌘K</kbd></button>
<SearchOverlay />
```

Set `ANTHROPIC_API_KEY` in the server environment for AI search. Without it,
the endpoint still returns keyword results.

## Knowledge Graph

The optional knowledge graph is generated offline and committed into the
consumer site:

```sh
pnpm exec hev-find-kg build
pnpm exec hev-find-kg verify
```

`build` writes `.hev-find/kg.json` and skips the model call when the current
content hash already matches. `verify` builds the site and checks that every
heading chunk URL points at a real rendered anchor.
