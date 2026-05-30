# @hev/astro-agentic-search

A ⌘K agentic search overlay for Astro docs sites. It is a **search-results
generator**, not a chatbot: given a query, it reranks your content collections
with Claude (Haiku by default, for speed) and returns a list of result cards
with AI-written one-line snippets — never a conversational answer.

- **Overlay UX** — native `<dialog>` command palette, open with `⌘K` / `Ctrl+K`
  or `/`, arrow-key navigation, `Enter` to open a result.
- **Search-results generator** — Claude selects, ranks, and writes a snippet per
  result. URLs are mapped server-side from document IDs, so they can't be
  hallucinated.
- **Zero runtime dependencies** — talks to the Anthropic API over `fetch`.
- **Themeable** — inherits your site's CSS custom properties (`--paper`,
  `--signal`, …) with sensible dark-mode fallbacks.

## Repo layout

```
.
├─ packages/ui      # the published package: @hev/astro-agentic-search
└─ playground       # a local Astro docs site that mirrors layer/site for dev
```

## Develop

```sh
pnpm install
cp playground/.env.example playground/.env   # add your ANTHROPIC_API_KEY
pnpm dev                                      # runs the playground
```

Open the playground and press `⌘K`.

## Use in a site

```js
// astro.config.mjs
import agenticSearch from '@hev/astro-agentic-search';

export default defineConfig({
  integrations: [
    agenticSearch({
      collections: ['docs'],     // content collections to index
      basePath: '/docs/',        // how slugs map to URLs
      // model: 'claude-haiku-4-5', maxResults: 6, endpoint: '/api/agentic-search'
    }),
  ],
});
```

```astro
---
// In your layout, once:
import SearchOverlay from '@hev/astro-agentic-search/components/SearchOverlay.astro';
---
<button data-agentic-search-open>Search <kbd>⌘K</kbd></button>
<SearchOverlay />
```

Set `ANTHROPIC_API_KEY` in the deploy environment. The injected endpoint is
on-demand, so the site needs a server adapter in production.
