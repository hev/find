# @hev/astro-agentic-search

A ⌘K agentic search overlay for Astro docs sites. It's a **search-results
generator**, not a chatbot: Claude (Haiku by default) reranks your content
collections and writes a one-line snippet per result. It never answers the
question conversationally.

## Install

```sh
pnpm add @hev/astro-agentic-search
```

## Configure

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import agenticSearch from '@hev/astro-agentic-search';

export default defineConfig({
  integrations: [
    agenticSearch({
      collections: ['docs'],   // required: collections to index
      basePath: '/docs/',      // slug -> URL prefix (default '/docs/')
    }),
  ],
});
```

| Option | Default | Description |
| --- | --- | --- |
| `collections` | – | Content collections to index (required). |
| `model` | `claude-haiku-4-5` | Claude model used to rerank + write snippets. |
| `endpoint` | `/api/agentic-search` | Injected on-demand route. |
| `basePath` | `/docs/` | Turns a doc slug into its page URL. |
| `maxResults` | `6` | Max results returned. |
| `candidatePool` | `12` | Keyword candidates handed to the model. |

## Add the overlay

```astro
---
import SearchOverlay from '@hev/astro-agentic-search/components/SearchOverlay.astro';
---
<button data-agentic-search-open>Search <kbd>⌘K</kbd></button>

<!-- once per page, e.g. at the end of your layout -->
<SearchOverlay />
```

Open with `⌘K` / `Ctrl+K`, or `/`. Any element with `data-agentic-search-open`
also opens it.

## Server requirements

- Set `ANTHROPIC_API_KEY` in the server environment.
- The search route is rendered on demand, so the site needs a
  [server adapter](https://docs.astro.build/en/guides/on-demand-rendering/) in
  production (e.g. `@astrojs/node`, `@astrojs/vercel`).

## Theming

The overlay reads your site's CSS custom properties with dark fallbacks:
`--paper` (background), `--ink` (text), `--muted`, `--signal` (accent), and
`--font-mono`. Define these on `:root` to match your brand.
