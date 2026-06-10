# RFC 0003: MCP as hydrate — one tool, a local filesystem, and instructions

## Summary

Reduce the ask MCP server to its smallest honest shape: **one tool plus
`instructions`.** The tool downloads the whole digest tree (RFC 0002) to local
disk and returns the title-tree inline; the `instructions` tell the agent to
`tree`/`cat`/`grep` it with its *own* filesystem tools and to cite every claim
with the section's `url`+`anchor`. The server stops being a set of query tools
that reimplement the disclosure ladder and becomes the thing that hands the
agent a filesystem and points at it.

This works because an MCP consumer is *already an agent*. It does not need our
reasoning, it needs our corpus — so the agentic `answer` loop drops out of the
MCP surface entirely and is reframed as an overlay-only feature. And it stays
cheap because the corpus is bounded (configured collections, no crawler): even a
large docs site compresses to a payload small enough to ship whole, so the tool
pulls the entire tree rather than diffing it.

The disclosure ladder is preserved, not abandoned: hydrating the tree to **disk**
is not loading it into **context**. The agent still climbs `tree → head → cat →
facts` into its context window — but now with the native tools it already trusts,
at filesystem speed, with no per-hop model round-trip.

This RFC depends on 0002's artifact and changes only `mcp.go` and the site's
serving of the tree.

## Motivation

**Tool-based MCP taxes every hop.** Today `ServeMCP` exposes seven read tools;
each navigation step — `search`, pick a result, `section get`, read, `section
get` again — is a round-trip through the model's tool-call loop. For a bounded
corpus that is pure overhead: if the agent had the whole tree on disk it would
`grep -r` and `cat` at filesystem speed and spend model turns only on
*deciding*, never on *fetching*.

**The consumer is an agent, so give it files, not answers.** The agentic
`answer` path exists to do retrieval-plus-synthesis for someone who can't — the
human at the ⌘K overlay. An agent handed the filesystem does its own synthesis;
wrapping our Claude loop around it would be one agent asking another to grep for
it. The split is clean: **overlay = synthesis (human consumer); MCP = files
(agent consumer).** `answer` is therefore a website feature, not a core agent
primitive.

**The filesystem already is the ladder.** RFC 0002 made the digest a literal
tree of markdown files where `tree`/`ls` are O(titles) and `cat` is O(one
section). An agent already knows that cost model. So the most faithful MCP
integration is not a tool vocabulary the agent must learn (`ask_search`,
`ask_section_get`) — it is "here are the files," after which the agent's *own*
`tree`/`cat`/`grep` enforce the ladder for free. We do not build, document, or
police progressive disclosure; we hand over a directory and the agent's tools do
the rest.

**The pieces are already there.** `ServeMCP(ctx, MCPOptions, stdin, stdout)` is
stdio — i.e. co-located with the agent's filesystem by construction —
and `MCPOptions.Endpoint` already lets the server proxy a remote
`/api/ask`. So "pull a remote site's tree to local disk" is mostly wiring an
existing proxy to an existing transport.

## Goals

- **One tool.** A single MCP tool that materializes the whole digest tree at a
  local path and returns the title-tree (rung 0) inline. No per-resource query
  tools.
- **`instructions` that teach the ladder *and* citation.** The MCP server's
  init-time `instructions` string is half the product: it tells the agent how to
  navigate (tree → titles → cat → grep, not cat-everything) and, non-
  negotiably, to cite each claim with `url`+`anchor`.
- **Ship the whole tree, compressed.** Pull the entire (gzipped) tree in one
  call; refresh is a single top-level hash check, not per-file diffing.
- **Cross-site hydrate.** `--endpoint https://hevask.com/api/ask` turns any
  deployed ask site into a local filesystem an agent can grep, from any repo.
- **Degrade honestly off-host.** When the MCP transport is *not* co-located with
  the agent's filesystem, fall back gracefully rather than promise filesystem
  semantics over a wire.

## Non-goals

- **No `answer` tool in MCP.** Dropped, deliberately; the agent synthesizes.
  `answer` stays the overlay's and the CLI's affair.
- **No revival of the seven query tools as the primary surface.** At most a
  single degraded `search` survives as the off-host fallback (open question).
- **No new disclosure ladder.** The ladder is RFC 0002's verbs and the agent's
  native tools; this RFC adds none.
- **No incremental *sync* engine.** Compression makes whole-tree pull cheap;
  per-file delta sync is explicitly not worth building. (Incremental *builds*
  are 0002's concern and unrelated.)
- **No artifact or wire-type changes.** 0002 froze those; this RFC consumes them
  and adds only a bulk-archive transport.

## Design

### The one tool

A single tool — working name `fetch_docs` (alternatives in open questions) —
parameterless except for an optional `force`:

```jsonc
// tool: fetch_docs
// input:  { "force": false }   // force re-pull even if the hash is unchanged
// effect: materialize the digest tree at a local cache path
// output: {
//   "path": "/Users/…/.cache/hev-ask/hevask.com",   // where the tree now lives
//   "contentHash": "7f3a…",                          // from _meta.md
//   "sections": 41,
//   "tree": "<the rung-0 title tree, inline>",
//   "upToDate": true                                 // hash matched; nothing re-pulled
// }
```

The tool's single responsibility is **put a filesystem on disk**. It does not
answer, search, or page — those are the agent's native tools over `path`.

### Return rung 0 inline; materialize 1–3 to disk

The tool result carries the **title-tree itself** (the cheap `tree` output) so
the agent is oriented from the first call with no second round-trip, and writes
the bodies/facts to disk for when it descends. One call bootstraps the whole
ladder: rung 0 in the tool result, rungs 1–3 (`head`/`cat`/`facts`) on disk.
The tool effectively *is* `tree`, with materialize-the-rest as its side effect.

### The `instructions`

MCP servers return an `instructions` string at init; here it is load-bearing —
it is the other half of "one tool + instructions." It must teach two things:

- **Navigation (the ladder):** "This is a tree of distilled markdown docs for
  <site> at the returned path. Read the inline title-tree first. Open a
  section's body with `cat <path>` only when its title says it is relevant;
  `grep` the tree for specifics; the `_glossary/` directory widens terms. Do not
  read every file."
- **Citation (non-negotiable):** "Answer from these files, and cite every claim
  with the section's `url` + `anchor` frontmatter as a deep link
  (`/docs/page#anchor`)." This is the easy thing to lose when the agent
  synthesizes off local files, and it is the entire grounded-deep-link value of
  ask. Navigation is obvious; citation is what the instructions exist to
  enforce.

### Transport: a bulk, compressed archive

The committed `.hev-ask/` tree is static, so serving it whole is simple:

- **Local** (`DigestPath`): copy the tree to the cache path.
- **Remote** (`Endpoint`): fetch a single compressed archive of the tree. The
  site exposes the committed tree as a static, gzipped asset (a build step packs
  `.hev-ask/` into e.g. `/.hev-ask.tar.gz`, or `/api/ask/archive` streams it).
  This is additive to the per-section JSON reads 0001/0002 already define — the
  archive serves *hydrate*, the JSON reads serve *verbs-over-endpoint*.

`_meta.md`'s `contentHash` is the freshness oracle: the tool fetches it (cheap),
compares against the cached tree, and re-pulls the whole archive only on a
mismatch (or `force`). Compression is what makes "re-pull the whole thing"
acceptable instead of building a delta protocol.

### Co-location, and the off-host fallback

Hydrate-to-disk assumes the MCP server and the agent's filesystem tools share a
host — **true for stdio MCP** (`ask mcp` over stdin/stdout, the signature we
have), false for a remote/SSE MCP transport where the agent cannot read what the
server wrote. So:

- **Co-located (stdio):** the one-tool + instructions design as above.
- **Off-host (remote MCP):** the agent has no shared filesystem, so we cannot
  promise `cat`. The fallback is either MCP **resources** (expose the tree as
  listable/readable resources the client reads over the protocol) or a single
  degraded `search` tool. The tool result should detect and signal which mode it
  is in. (Which fallback — resources vs. one search tool — is an open question.)

### Cross-site hydrate

Because the tool can pull from `Endpoint`, an agent in repo X can run
`fetch_docs` against `--endpoint https://hevask.com/api/ask` and get hevask.com's
docs as a local filesystem to grep — no checkout of that repo, no API key. The
MCP server becomes a **bridge that turns any deployed ask site into a local
tree**, which is a genuinely new capability and nearly free given the endpoint
proxy already exists.

### Where it writes

Lean: an XDG cache dir keyed by source host —
`~/.cache/hev-ask/<host>/` — so cross-site pulls don't collide and the agent's
working repo is never dirtied (a repo-local `.hev-ask/` would collide with the
*committed* digest when the agent is inside an ask-enabled repo). Overridable via
a new `MCPOptions` field. (Final location is an open question.)

## Consequences

- **`mcp.go` shrinks** from seven query tools to one tool + an `instructions`
  string + the archive fetch and cache-write. Net simpler, and the simplification
  is the feature.
- **The MCP surface stops duplicating the CLI verbs.** They become the same
  *files*: the verbs (0002) and MCP (here) are no longer two reimplementations
  of one ladder — the agent's native tools are the ladder over a shared tree.
- **`answer` is now explicitly overlay/CLI-only.** CLAUDE.md's "three
  consumption surfaces" framing updates: overlay = synthesis, MCP = files, CLI =
  both transports.
- **The site grows a static archive asset** (small, compressed, cache-friendly
  on Cloudflare Pages) and an agent-facing way to consume it that needs no key.
- **0001's "stdio MCP server (7 read tools)" line is superseded** — the frozen
  `ServeMCP` surface becomes one tool + instructions; `MCPOptions` gains a cache-
  path field. Like 0002, this is a freeze-window revision, affordable because
  0001 is unimplemented.

## Migration

- **No external consumers**; `mcp.go` is in-repo, reshaped, not extended.
- **The seven query tools go away** (or collapse to one fallback `search`); any
  doc or example referencing the old MCP tool list updates with the docs PR.
- **Gates:** `go test ./...`, an MCP round-trip test (tool returns a path, the
  path contains the tree, the inline title-tree matches `tree`), and a cross-site
  pull against a deployed endpoint.

## Sequencing

Docs-first, and after 0002 ships its artifact:

1. **Docs PR** — an "MCP" / "use ask from an agent" page: the one tool, the
   instructions, the citation rule, the cross-site example, the co-location
   caveat. Update the three-surfaces framing in `concepts.mdx` and CLAUDE.md.
   Review settles the tool name, cache location, and the off-host fallback.
2. **Site archive** — build step packs `.hev-ask/` into a served compressed
   asset; freshness via `contentHash`.
3. **`mcp.go` reshape** — one `fetch_docs` tool; the `instructions` string;
   archive fetch + cache write keyed by host; `force`; off-host detection +
   fallback; drop `answer` and the query tools.
4. **Fold into 0001** — update its frozen `ServeMCP` description and
   `MCPOptions` to this shape before v0.2.0 tags.

## Open questions

- **Tool name.** `fetch_docs`, `pull`, `sync_docs`, `hydrate`? It should read
  well in a client's tool list as "the thing that gives me the docs."
- **Cache location.** `~/.cache/hev-ask/<host>/` (lean) vs. a caller-supplied
  path vs. an OS temp dir. Keying by host is the part that matters for cross-
  site.
- **Off-host fallback: resources or one `search` tool?** MCP resources are the
  protocol-native way to expose a tree without a shared filesystem, but not every
  client surfaces them usefully to the model; a single `search` tool is cruder
  but universally consumable.
- **Does `fetch_docs` ever take a `path` to scope a partial pull?** The whole
  point is "grab it all and it's small," so probably never — but a giant corpus
  could want `fetch_docs path=api/` someday. Resist until it bites.
- **Refresh ergonomics.** Pull-on-demand with a hash check (lean) is simplest;
  is there any case for a background watch or a TTL? Likely not for a tool an
  agent calls explicitly.
- **Should the inline title-tree be capped** for a very large corpus, with a note
  that it was truncated and `tree <subpath>` continues — or is the bounded-corpus
  assumption enough that it always fits?

## References

- `0002-digest-as-filesystem.md` — the section-tree artifact and the
  `tree`/`cat`/`grep` ladder this RFC hands to the agent.
- `0001-embeddable-ask-command.md` — the `ServeMCP` "7 read tools" surface this
  RFC supersedes; the v0.2.0 freeze window both revisions share.
- `pkg/ask/mcp.go` — the server being reshaped to one tool + instructions;
  `MCPOptions` — gains a cache-path field.
- `CLAUDE.md` — the bounded-corpus (collections-only, no crawler) fact that makes
  whole-tree hydrate cheap; the three-surfaces framing this RFC sharpens.
