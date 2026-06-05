# hev ask

A `⌘K` search overlay for Astro docs sites: instant keyword search with
heading-anchor deep links, plus an optional Claude-powered answer loop on
`Enter`. Shipped as the npm package `@hevmind/ask`.

**Docs, quick start, and live demo: [askhev.com](https://askhev.com)** — the
site searches itself with `@hevmind/ask`; press `⌘K` to see it work.

## Repo layout

```
.
├─ packages/ui   # the publishable package: @hevmind/ask
├─ playground    # a minimal Astro docs site for fast local dev
└─ site          # docs + showcase site (askhev.com)
```

## Develop

```sh
pnpm install
cp playground/.env.example playground/.env   # add ANTHROPIC_API_KEY for AI search/digest builds
pnpm dev
```

Open the playground and press `⌘K`. For the docs site:

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
pnpm digest:build
pnpm digest:verify
```

## Publishing

The package is structured for npm distribution as `@hevmind/ask`, with `src`
exports for Astro/Vite consumers plus the `ask` bin for
CLI use from `node_modules`. Until it's published, consume it from the package
subdirectory on GitHub:

```sh
pnpm add "git+ssh://git@github.com/hev/ask.git#main&path:/packages/ui"
```

Before publishing:

1. Set the intended semver in `packages/ui/package.json`.
2. Run `pnpm build:npm-binaries` to populate the optional platform packages.
3. Run `pnpm test`, `pnpm typecheck`, `pnpm build`, and `pnpm digest:verify`.
4. Dry-run the package with `pnpm --filter @hevmind/ask pack --dry-run`.
5. Publish from `packages/ui` with `pnpm publish --access public`.
6. Move consumers from the Git dependency to `@hevmind/ask@<version>`.
