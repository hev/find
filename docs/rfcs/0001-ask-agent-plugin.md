# RFC 0001: Package hev ask as an installable agent plugin

## Summary

Ship `@hevmind/ask` as a one-command **agent plugin** for Claude Code
and Cursor, mirroring the marketplace layout Turbopuffer uses in
[`turbopuffer/skills`](https://github.com/turbopuffer/skills). The
plugin wraps the MCP server ask already has (`ask mcp`) plus a skill
that teaches an agent how to use its tools, so any docs site built on
`@hevmind/ask` can also publish an agent plugin for its docs with no
hand-written MCP config. We adopt the same `.claude-plugin` /
`.cursor-plugin` / `marketplace.json` shape Turbopuffer ships, so ask
plugins are installable, discoverable, and cross-listable in that
ecosystem.

## Motivation

ask already has both halves of an agent integration and no packaging
around them:

- **An MCP server.** `ask mcp` is a stdio MCP server exposing
  `search`, `section_get`, `sections_list`, `glossary_get`,
  `overview`, and `answer` over the committed digest (or a deployed
  `/api/ask` endpoint). It is documented (`api/mcp.mdx`) and works
  today — but a user wires it in by hand-editing an `mcpServers` block.
- **Domain context.** The digest *is* a curated glossary + section map
  of a docs site — exactly the context a coding agent working against
  that product wants.

Turbopuffer solved the packaging problem for the same shape in
`turbopuffer/skills`: a `marketplace.json` at the repo root, a
`plugins/<name>/.claude-plugin/plugin.json` that declares an
`mcpServers` block, a parallel `.cursor-plugin`, and a `skills/`
directory of SKILL.md guidance. Install is one line —
`/plugin marketplace add turbopuffer/skills` — and the agent gets a
docs-search MCP tool plus usage guidance.

ask should match that layout exactly, for three reasons:

1. **Zero-glue install** for ask itself: `/plugin marketplace add
   hev/ask` instead of a hand-written `mcpServers` stanza.
2. **Portable to every consumer site.** ask's value is that a docs
   author adopts it and their site gets search. The plugin extends
   that: the author also gets an installable agent plugin for *their*
   docs, generated from their digest — the same leverage, one layer up.
3. **Ecosystem fit.** Turbopuffer's repo is the reference
   implementation of the Claude Code plugin-marketplace pattern.
   Matching it makes ask plugins behave like the plugins agent users
   already know, and opens cross-listing / co-marketing with that
   ecosystem.

This is the agent-plugin idea from the layer ↔ Turbopuffer
collaboration review, landed where it actually belongs: ask is hev's
agent-facing docs surface, not the gateway.

## Goals

- A plugin marketplace at the ask repo root (`.claude-plugin/
  marketplace.json`) listing a `hev-ask` plugin.
- A `plugins/hev-ask/` plugin with:
  - `.claude-plugin/plugin.json` declaring an `mcpServers` entry that
    runs `ask mcp` (local stdio over `.hev-ask/digest.json` by default;
    `--endpoint` form for a deployed site).
  - a `.cursor-plugin` equivalent.
  - a `skills/` SKILL.md teaching an agent when and how to use the ask
    tools (search before answering, `section_get` for detail, `answer`
    only when an endpoint is configured).
- Both install paths documented: local/keyless (digest on disk) and
  deployed (endpoint).
- A generator path so a **consumer** site can emit its own plugin from
  its digest — the plugin is a thin, digest-parameterized template, not
  hand-authored per site.
- A docs page (`api/plugin.mdx`) covering install and the
  generate-for-your-site flow; `api/mcp.mdx` stays the protocol-level
  reference the plugin sits on.

## Non-goals

- **Replacing `ask mcp` or the `/api/ask` endpoint.** The plugin is
  packaging over the existing MCP server, not a new server. All
  substantive behavior stays in `pkg/ask`.
- **A hosted MCP endpoint.** Turbopuffer's plugin points at a hosted
  HTTP MCP (`turbopuffer.stlmcp.com`). ask's default is the local stdio
  server over the committed digest — keyless and offline, consistent
  with ask's "everything degrades, nothing hard-fails" posture. A
  hosted form can come later; it is not required to ship.
- **New retrieval capability.** The plugin exposes the tools ask
  already has. Improving them is separate work.
- **Cursor/Claude-Code-specific tool logic.** The two plugin manifests
  wrap the same MCP server; we do not fork behavior per host.

## Proposed shape

Mirror `turbopuffer/skills`:

```
.claude-plugin/
  marketplace.json                 # lists the hev-ask plugin
plugins/
  hev-ask/
    .claude-plugin/
      plugin.json                  # mcpServers -> `ask mcp`
    .cursor-plugin/                # Cursor equivalent
    skills/
      ask/SKILL.md                 # how an agent should use the tools
    CLAUDE.md                      # plugin-local guidance
```

`plugins/hev-ask/.claude-plugin/plugin.json` (local, keyless default):

```json
{
  "name": "hev-ask",
  "version": "0.1.0",
  "description": "Search and answer over an Astro docs site's committed ask digest.",
  "repository": "https://github.com/hev/ask",
  "license": "MIT",
  "mcpServers": {
    "hev-ask": {
      "command": "ask",
      "args": ["--digest-path", ".hev-ask/digest.json", "mcp"]
    }
  }
}
```

The deployed variant swaps `args` for `["--endpoint", "<url>", "mcp"]`,
which also enables the `answer` tool — the exact two forms already in
`api/mcp.mdx`. The plugin templates are those two stanzas with the
digest path / endpoint as the only parameters.

`skills/ask/SKILL.md` gives the agent the usage contract: call `search`
to locate sections, `section_get` to read one, `glossary_get` for
terms, `overview` for orientation, and `answer` only when an endpoint
is configured. This is the SKILL.md half Turbopuffer pairs with its MCP
server, adapted to ask's tool set.

### Consumer generation

A consumer site (any `@hevmind/ask` adopter) should be able to emit a
plugin for its own docs from its digest. Shape options, to settle in
implementation:

- An `ask plugin init` CLI verb that writes a `plugins/<site>/` tree
  parameterized by the site's digest path / endpoint and name.
- Or a documented copy-this-template path if a CLI verb is more surface
  than warranted for 0.1.

Either way the plugin is a thin wrapper over `ask mcp`; the digest is
the per-site content, so generation is parameter substitution, not
authoring.

## Collaboration with Turbopuffer

- **Same marketplace schema.** Use the
  `anthropic.com/claude-code/marketplace.schema.json` shape
  `turbopuffer/skills` uses, so ask plugins are first-class in the same
  tooling.
- **Cross-listing.** Once ask's plugin is stable, it can be listed
  alongside Turbopuffer's in shared discovery surfaces; both are
  docs-search-for-agents plugins built on MCP.
- **Pattern feedback.** Anything ask needs that the marketplace schema
  doesn't express is upstream feedback to the plugin ecosystem, not a
  private extension.

## Migration

Purely additive — no change to `ask mcp`, the digest, or the endpoint:

1. Add `.claude-plugin/marketplace.json` and `plugins/hev-ask/`.
2. Add `api/plugin.mdx`; cross-link from `api/mcp.mdx`.
3. (If chosen) add the `ask plugin init` verb and document it in
   `api/cli.mdx`.

Existing manual `mcpServers` users are unaffected; the plugin is a
convenience layer over the same server.

## Open questions

- **CLI verb vs. template.** Is `ask plugin init` worth the public-API
  surface for 0.1, or is a documented template enough until a consumer
  asks for generation? Lean template-first; add the verb when a real
  adopter wants it.
- **Local vs. hosted default.** Local stdio over the committed digest
  is the keyless, offline default and matches ask's degrade-don't-fail
  posture. A hosted HTTP MCP (Turbopuffer's choice) is a later option,
  not 0.1.
- **`answer` and keys.** The `answer` tool needs a deployed endpoint
  with a server-side key. The plugin should make the local-keyless vs.
  endpoint-with-`answer` tradeoff obvious at install, so users aren't
  surprised by an `answer` tool error in local mode.
- **Versioning the plugin with the package.** Whether the plugin
  version tracks `@hevmind/ask`'s version or moves independently. Start
  coupled; split only if the plugin surface evolves separately.

## References

- [`turbopuffer/skills`](https://github.com/turbopuffer/skills) — the
  reference Claude Code + Cursor plugin marketplace this RFC mirrors:
  root `marketplace.json`, `plugins/<name>/.claude-plugin/plugin.json`
  with an `mcpServers` block, `.cursor-plugin`, and `skills/`. MIT.
- `site/src/content/docs/api/mcp.mdx` — `ask mcp`, the stdio MCP server
  and its tools (`search`, `section_get`, `answer`, …) the plugin wraps.
- `site/src/content/docs/api/cli.mdx` — the `ask` bin; where an
  `ask plugin init` verb would land.
- `CLAUDE.md` (ask) — the digest, the degrade-don't-fail posture, and
  the consumer-site model the per-site plugin generalizes.
