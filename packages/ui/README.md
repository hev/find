# @hevmind/ask

hev ask is a heading-anchored search overlay for docs sites. The digest is built
from your markdown, not your renderer — **Astro** gets the turnkey integration
below, and **Docusaurus, VitePress, MkDocs, or any static site** get the same
overlay as a one-script drop-in (see [Frameworks](https://hevask.com/docs/frameworks)).
Typing runs instant keyword search; pressing `Enter` runs an optional Claude
search loop that chooses sub-queries and ranks section results.

## Install

```sh
pnpm add @hevmind/ask
```

For the current GitHub-hosted monorepo package before npm publication:

```sh
pnpm add "git+ssh://git@github.com/hev/ask.git#main&path:/packages/ui"
```

## Configure

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import hevAsk from '@hevmind/ask';

export default defineConfig({
  integrations: [
    hevAsk({
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
| `endpoint` | `/api/ask` | Injected on-demand route. |
| `basePath` | `/docs/` | Turns a doc slug into its page URL. |
| `maxResults` | `6` | Max results returned. |
| `maxIterations` | `4` | Max search-loop rounds. |
| `chunkHeadingDepth` | `3` | Chunk at `##` through this heading depth. |
| `candidatePerSearch` | `8` | Chunks returned by each search tool call. |
| `perDocCap` | `2` | Max chunks per document in one prefilter call. |
| `digestModel` | `claude-opus-4-8` | Offline digest build model. |
| `digestDir` | `.hev-ask` | Committed digest tree directory. |
| `digestPath` | `.hev-ask` | Deprecated alias for `digestDir`. |
| `digestContentGlobs` | derived from `collections` | Build-time Markdown/MDX corpus globs. |

## Add the overlay

```astro
---
import SearchOverlay from '@hevmind/ask/components/SearchOverlay.astro';
---
<button data-hev-ask-open>Search <kbd>⌘K</kbd></button>

<!-- once per page, e.g. at the end of your layout -->
<SearchOverlay />
```

Open with `⌘K` / `Ctrl+K`, or `/`. Any element with `data-hev-ask-open` also
opens it. Typing returns keyword results immediately. Press `Enter` to ask AI,
or move the selection with arrows/hover and press `Enter` to open a keyword hit.

## Ask digest

```sh
ask digest build
ask digest verify
```

The builder writes the `.hev-ask/` markdown tree, which should be committed.
Builds are hash-gated, so unchanged content does not spend another Opus call.
`verify` builds the site and checks that every chunk anchor exists in `dist`.

hev ask uses `github-slugger` to match Astro heading anchors exactly.

Recommended CI gates:

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm digest:verify
```

## Publishing

This package is intended to publish as `@hevmind/ask`. Before publishing, bump the
version, run the verification gates, inspect `pnpm --filter @hevmind/ask pack
--dry-run`, then publish from this package directory with:

```sh
pnpm publish --access public
```

After publish, consumers should depend on the npm semver range instead of the
Git `path:/packages/ui` dependency.

Git dependencies are acceptable for local integration while the package is not
yet published, but they are not the long-term distribution path.

## Other frameworks

The Astro integration above is the turnkey path. On any other framework you build
the digest the same way (`ask digest build`), bundle the static assets
(`ask digest bundle`), and drop in the prebuilt overlay as a `<script>` tag —
keyword search runs fully static, no server. For agentic answers, deploy the
standalone endpoint and point the overlay at it. See
[Frameworks](https://hevask.com/docs/frameworks) for Docusaurus, VitePress,
MkDocs, and plain-HTML recipes.

## Server Requirements

- Keyword search runs **fully static** — the drop-in overlay reads the committed
  digest in the browser, no server required.
- The **agentic** path needs a runtime: on Astro, `/api/ask` is rendered on
  demand (so the site needs a server adapter in production); on other frameworks,
  it's the standalone hostable endpoint.
- Set `ANTHROPIC_API_KEY` in that server environment for AI search and fresh
  digest generation. Without a runtime key, the endpoint still serves keyword
  results.

## Theming

The overlay reads your site's CSS custom properties with dark fallbacks:
`--paper` (background), `--ink` (text), `--muted`, `--signal` (accent), and
`--font-mono`. Define these on `:root` to match your brand.
