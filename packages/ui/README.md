# @hev/find

hev find is a heading-anchored search overlay for Astro docs sites. Typing runs
instant keyword search; pressing `Enter` runs an optional Claude search loop that
chooses sub-queries and ranks section results.

## Install

```sh
pnpm add @hev/find
```

For the current GitHub-hosted monorepo package before npm publication:

```sh
pnpm add "git+ssh://git@github.com/hev/find.git#main&path:/packages/ui"
```

## Configure

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import hevFind from '@hev/find';

export default defineConfig({
  integrations: [
    hevFind({
      collections: ['docs'],
      basePath: '/docs/',
    }),
  ],
});
```

| Option | Default | Description |
| --- | --- | --- |
| `collections` | - | Content collections to index. |
| `model` | `claude-haiku-4-5` | Runtime search-loop model. |
| `endpoint` | `/api/find` | Injected on-demand route. |
| `basePath` | `/docs/` | Turns a doc slug into its page URL. |
| `maxResults` | `6` | Max results returned. |
| `maxIterations` | `4` | Max search-loop rounds. |
| `chunkHeadingDepth` | `3` | Chunk at `##` through this heading depth. |
| `candidatePerSearch` | `8` | Chunks returned by each search tool call. |
| `perDocCap` | `2` | Max chunks per document in one prefilter call. |
| `kgModel` | `claude-opus-4-8` | Offline KG build model. |
| `kgPath` | `.hev-find/kg.json` | Committed KG artifact path. |
| `kgContentGlobs` | derived from `collections` | Build-time Markdown/MDX corpus globs. |

## Add the overlay

```astro
---
import SearchOverlay from '@hev/find/components/SearchOverlay.astro';
---
<button data-hev-find-open>Search <kbd>⌘K</kbd></button>

<!-- once per page, e.g. at the end of your layout -->
<SearchOverlay />
```

Open with `⌘K` / `Ctrl+K`, or `/`. Any element with `data-hev-find-open` also
opens it. Typing returns keyword results immediately. Press `Enter` to ask AI,
or move the selection with arrows/hover and press `Enter` to open a keyword hit.

## Knowledge Graph

```sh
hev-find-kg build
hev-find-kg verify
```

The builder writes `.hev-find/kg.json`, which should be committed. Builds are
hash-gated, so unchanged content does not spend another Opus call. `verify`
builds the site and checks that every chunk anchor exists in `dist`.

hev find uses `github-slugger` to match Astro heading anchors exactly.

Recommended CI gates:

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm kg:verify
```

## Server Requirements

- Set `ANTHROPIC_API_KEY` for AI search and fresh KG generation.
- Without a runtime key, `/api/find` still serves keyword results.
- The search route is rendered on demand, so the site needs a server adapter in
  production.

## Theming

The overlay reads your site's CSS custom properties with dark fallbacks:
`--paper` (background), `--ink` (text), `--muted`, `--signal` (accent), and
`--font-mono`. Define these on `:root` to match your brand.
