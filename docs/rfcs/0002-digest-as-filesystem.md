# RFC 0002: The digest is a filesystem — a section tree and the read verbs over it

## Summary

Stop treating the ask digest as one opaque JSON blob and make it a literal
filesystem: a tree of one markdown-plus-frontmatter file per section, committed
as the sole digest artifact. The read verbs become the shell over that tree —
`tree`, `ls`, `head`, `cat`, `facts`, `grep` over path keys — replacing the
kubectl-style `sections list` / `section get` / `glossary list` / `overview`
surface. The filesystem metaphor stops being a metaphor: `ls` is O(titles),
`cat` is O(one section), and a model already knows which is cheap.

This is a progressive-disclosure design expressed as a directory. A listing
(`tree`/`ls`) returns titles and nothing else — never a body, by construction,
because the listing reads only frontmatter. Going deeper is always an explicit
verb: `head` for the one-line summary, `cat` for the body, `facts` for the
grounded claims. Four rungs, each a strictly larger slice of one file, each
chosen.

Crucially, this is an *on-disk format and authoring/navigation* change. The
in-memory `Digest`/`DigestNode` types and the JSON `/api/ask` wire contract
survive unchanged — the blast radius is the artifact, the load path, and the
verb names, not the type system. MCP and the agentic `answer` loop are out of
scope here and move to a follow-on RFC (0003); this RFC is the filesystem and
the verbs over it.

## Motivation

**The thesis: the digest already *is* a filesystem; we just store it as a
blob.** A docs corpus is a tree — groups contain pages, pages contain
heading-level sections — and a URL like `/docs/quick-start#install` is a path.
Today we flatten that tree into `.hev-ask/digest.json` and then reconstruct
navigation over it with bespoke verbs (`sections list --group`, `section get
<id>`). Storing it as the tree it already is collapses three layers into one
shape: storage (a directory), interface (`ls`/`cat`), and — in the follow-on —
transport (a section per path).

**The target consumer is an agent, not a human.** An agent handed a directory
navigates it with the filesystem tools it already has, on cost intuitions it
already holds — `ls` before `cat`, `grep` to locate, frontmatter titles to
decide. We don't have to teach, document, or police a disclosure ladder; the
filesystem is the ladder. A bare-heading title that forces a `cat` is the only
failure mode, and that is a digest-build quality problem (see *Titles*), not an
interface problem.

**Reviewability becomes real.** CLAUDE.md sells the digest as "committed JSON…
reviewable on purpose," but one blob is the least reviewable form of that
promise. A per-section markdown diff is what reviewable actually looks like: a
human sees one section's distilled prose and its grounded facts change
together, in the same format the source docs are written in. The digest becomes
a *distilled mirror* of the content collection — same shape (md + frontmatter),
thinner content.

**The plumbing already exists at the wrong granularity.** `shard.go` already
splits the corpus into per-shard files (`input-<id>.json`,
`distill-<id>.json`), hashes each (`ShardHash`), tracks a `ShardManifest`, and
treats a distillation as valid only for its exact hash. The build already
explodes into files midway and then *re-collapses* them into one JSON in
`assemble`. This RFC mostly stops the collapse and finishes at a finer,
per-section granularity.

## Goals

- **One committed artifact: a section tree.** `.hev-ask/` holds one markdown
  file per section, plus `_meta.md` and a `_glossary/` directory. No committed
  JSON.
- **Filesystem verbs over path keys.** `tree`, `ls [path]`, `head <path>`,
  `cat <path>`, `facts <path>`, `grep <query>` — path-addressed
  (`cat overview/quick-start`), not ID-addressed.
- **A four-rung disclosure ladder, structurally enforced.** A listing reads
  only frontmatter and therefore *cannot* leak a body; each deeper rung is a
  distinct verb.
- **Titles carry the listing's whole decision signal**, authored when the
  content collection provides one and model-synthesized at build when it does
  not.
- **Incremental builds.** Re-distill only the sections whose content hash
  changed — saving Opus calls, the dominant build cost.
- **No regression in grounding.** Every section still carries its
  `url`+`anchor` and its facts/sources; `ask digest verify` still gates anchor
  drift against `github-slugger`.

## Non-goals

- **MCP is not in this RFC.** "One tool + instructions that hydrates the tree
  to local disk and lets the agent `tree`/`cat`/`grep` it natively" is the
  whole shape of RFC 0003 and depends on this artifact existing. This RFC adds
  and changes nothing in `mcp.go`.
- **No sync/transport design, no compression.** How an agent pulls a *remote*
  tree to disk — and the observation that even big collections compress small
  enough to just ship whole — belongs to 0003. This RFC is the local artifact
  and the local/endpoint verbs.
- **`answer` is untouched.** The agentic SSE path is a remote call, format-
  agnostic; it neither reads the tree nor changes here. (0003 reframes it as
  overlay-only, but that is a framing note, not a code change.)
- **No new in-memory types, no wire change.** `Digest`/`DigestNode`/`Fact`/
  `SourceRef`/`GlossaryEntry` stay; `/api/ask` keeps returning JSON. See *What
  does not change*.
- **No site-nav change.** The human docs nav stays driven by
  `site/src/lib/docs.ts`. The tree's own order is a separate, agent-facing
  concern carried in frontmatter.

## Design

### The artifact: a section tree of markdown + frontmatter

```
.hev-ask/
  _meta.md                     # overview, context, suggestions, version, contentHash, group order
  _glossary/
    digest.md                  # term, aliases, definition
    keyword-mode.md
  overview/
    introduction.md
    quick-start.md
    concepts.md
    tradeoffs.md
    limits.md
  api/
    configuration.md
    endpoint.md
    cli.md
```

One file per **section** (heading-level chunk — the existing node granularity).
Leaning small is deliberate: the consumer is an agent, `cat` should be
section-precise, and `tree` wants the section titles anyway. Underscore-
prefixed names (`_meta`, `_glossary`) are the non-section entries so they sort
first and never collide with a real doc slug.

There is **no JSON**. The build ledger that used to live in a manifest — content
hash, schema version, per-section hash, group/section order — lives in
frontmatter: each section file carries its own `hash`; `_meta.md` carries
`version`, `contentHash`, `generatedAt`, and the group/section ordering.
Everything is markdown; `verify` and incremental-build both read frontmatter.

### What a section file looks like

```markdown
---
title: Quick start — add hev ask to an Astro site in five minutes
heading: Quick start                    # literal rendered anchor text
group: overview
order: 2
url: /docs/quick-start
anchor: quick-start                      # github-slugger output; verify gates this
terms: [digest, integration, adapter]
hash: 7f3a…                              # this section's content hash (incremental gate)
mode: keyword
facts:
  - { kind: command,  literal: "pnpm add @hevmind/ask",  chunkId: quick-start#install }
  - { kind: config,   literal: "hevAsk()",                chunkId: quick-start#configure }
sources:
  - { chunkId: quick-start#install,   url: /docs/quick-start#install,   anchor: install }
  - { chunkId: quick-start#configure, url: /docs/quick-start#configure, anchor: configure }
---

Add hev ask to an Astro docs site in five minutes: install the package, add the
integration, drop the overlay in a layout.

<full distilled section body continues here…>
```

The first paragraph is the **summary** (`head`'s payload). Everything below the
frontmatter is the **body** (`cat`'s payload). The frontmatter arrays are the
**facts** (`facts`' payload). One file, three rungs.

### The verb surface: a filesystem, four rungs

| Rung | Verb | Reads from the file | Replaces (0001) |
| --- | --- | --- | --- |
| 0 | `tree` | every `title`, as a tree | *(new)* |
| 0 | `ls [path]` | titles under a group/path | `sections list [--group G]` |
| 1 | `head <path>` | `title` + summary paragraph | *(was folded into `section get`)* |
| 2 | `cat <path>` | full body | `section get <id>` |
| 3 | `facts <path>` | `facts` / `sources` / `terms` | *(was `--json` only)* |
| — | `cat /` (or `cat _meta`) | overview + context | `overview` |
| — | `ls /glossary` · `cat /glossary/<term>` | terms · definition | `glossary list` · `glossary get` |
| — | `grep <query>` | one KWIC line per hit | `search <query>` |
| — | `answer <query>` | *(remote SSE, unchanged)* | `answer` |

Path-addressed throughout: `cat overview/quick-start`, `ls api/`,
`cat /glossary/digest`. Paths compose (`ls overview/` → `cat
overview/limits`), tab-complete, and mirror the live `url`. The opaque `<id>`
key is gone.

Two disciplines make the ladder real:

- **A listing reads frontmatter only.** `tree`/`ls` open no bodies; their output
  is bounded by O(sections × one line) regardless of content size — a property
  worth a unit test, because it is what makes the cheap rungs safe to call
  speculatively.
- **`grep`'s snippet is one keyword-in-context line**, the *evidence of the
  match*, never a paragraph. The moment a snippet grows multi-line it has become
  `cat` wearing a `grep` costume; the format caps it.

`facts` vs. `cat --facts` is a naming choice (see open questions); the rung
exists either way, so the grounded claims stop being reachable only through a
serialization flag.

### Titles: authored or synthesized

`title` is the only field that survives into a listing, so it is the highest-
leverage field in the digest. The rule:

- **Authored** when the content collection provides one. Page-level frontmatter
  already requires `title` (`content.config.ts`), so every page node copies it.
- **Synthesized at build** for sub-headings, which have only heading text. The
  model writes a descriptive one-liner into `title` while `heading` keeps the
  literal anchor text. The `Title`/`Heading` split already exists in
  `DigestNode`; this RFC makes the build exploit it instead of copying
  heading → title.

This is the resolution of the standing tension between "titles must carry the
decision" and "listings hold only titles": titles are engineered to be maximally
informative within one line, and the *build* is on the hook for it. A corpus of
bare-heading titles makes the ladder unusable (every decision forces a `cat`),
so title synthesis is load-bearing, not cosmetic.

### What does *not* change: in-memory types and the JSON wire

This is the de-risking core of the design. The markdown tree is a **storage,
authoring, review, and local-navigation** format. It is *not* a new runtime
representation:

- **In-memory stays `Digest`/`DigestNode`.** `LoadDigest` learns to read a
  directory (or an `embed.FS`) — globbing the section files and parsing
  frontmatter+body into the existing structs — instead of unmarshalling one
  JSON. The types in `types.go` are unchanged; only the loader changes.
- **The wire stays JSON.** `EndpointClient` and `/api/ask` are unaffected: the
  server parses its own tree into `DigestNode`s and serializes JSON exactly as
  today. A consumer hitting `--endpoint` sees no difference. (The verbs render
  the same structs whether they came from a local tree or the endpoint.)
- **`SearchDigest` is unchanged.** It already operates over the in-memory
  `Digest`; it does not care that the bytes arrived as a tree.

So the surface that actually moves is small: the on-disk artifact, the
`LoadDigest`/`ParseDigest` load path, the verb names/dispatch in `command.go`,
and the `assemble` output. Everything downstream of "we have a `Digest` in
memory" is untouched.

### The build: `assemble` explodes instead of merging; incremental

`assemble` stops writing one `digest.json` and instead writes the section tree
(plus `_meta.md` and `_glossary/`). Because each section file carries its own
`hash`, the build gains incrementality for free: `digest build` distils only the
sections whose hash changed against the committed tree, leaving the rest. Opus
calls — the dominant cost — drop to the size of the diff, not the corpus. The
existing shard machinery already proves the pattern at coarse (~50k-token)
granularity; this extends per-hash validity down to the section.

`ask digest verify` keeps its job: recompute each section's `anchor` with
`github-slugger` and assert it matches the rendered Astro `id`, byte-for-byte.
It now also asserts tree integrity — every section file parses, `_meta.md`'s
`contentHash` matches, no orphan files — making it the single CI gate over the
tree.

### The virtual module and the site

`virtual:hev-ask/digest` changes from importing one JSON to globbing the tree
(`import.meta.glob('.hev-ask/**/*.md')`) and assembling the in-memory `Digest`
at build — exactly the mechanism Astro content collections already use. No
committed JSON, no derived JSON file: the in-memory index is built at boot from
the tree. If runtime keyword search ever needs a prebuilt flat index for speed,
it is constructed in memory at startup, never written as a source-of-truth file.

The CLI verbs over a *local* tree are, for an agent, thin conveniences over what
native `tree`/`cat`/`grep` already do — so they earn their keep on two jobs:
the `--endpoint` path (no local tree) and the **format-stable slices** raw
`cat` cannot give (`head` returning *only* the summary, `facts` extracting
frontmatter). We should not build a bespoke ranked `grep` engine to compete with
the agent's own grep; our `grep` matters for the endpoint case.

### Relationship to RFC 0001

0002 reshapes the exact surface 0001 proposes to freeze, so the two must be
sequenced deliberately. 0001 freezes the verb set (`glossary`/`sections`/
`section`/`overview`/`search`), `LoadDigest`/`ParseDigest([]byte)`, and a
committed `digest.json`; 0002 renames the verbs, makes the load path read a
tree (`embed.FS`, not `[]byte`), and removes the JSON.

Since **0001 is still unimplemented**, the clean resolution is: **0002 lands
first and 0001's freeze freezes the post-0002 shape.** Concretely, that revises
three things in 0001 before it ships:

- The frozen verb list becomes `tree`/`ls`/`head`/`cat`/`facts`/`grep`/
  `answer`/`mcp`.
- `ParseDigest([]byte)` becomes a tree/`fs.FS` loader; the `go:embed` story in
  0001 (offline read verbs) embeds a *directory* (`//go:embed all:.hev-ask`),
  which is strictly better — `embed.FS` over a tree is the natural Go shape.
- The "ship a committed `digest.json`" language in 0001's goals becomes "ship a
  committed `.hev-ask/` tree."

Everything else 0001 freezes — `CommandGroup`, `EndpointClient`, the JSON wire
types — is unchanged by 0002, which is precisely why the pivot is affordable
this close to the v0.2.0 freeze window 0001 identifies.

## Consequences

- **The digest becomes git-reviewable at section granularity** and stops being
  a merge-conflict magnet; the cost is many small files instead of one, which
  for a bounded, no-crawler corpus is a non-issue.
- **CLAUDE.md's "committed JSON, hash-gated" language is superseded** — it
  becomes "committed markdown tree, per-section hash-gated" — and the digest
  format section, the common-commands, and the public-surface bullets update
  with it.
- **`api/cli.mdx` is rewritten** around the filesystem verbs; the kubectl verbs
  are gone, not aliased (we are early, per the project's own "a big pivot is
  fine for our users" stance).
- **Build cost drops** from whole-corpus to diff-sized via per-section
  incrementality; the `build-digest` skill's corpus → distil → assemble flow
  keeps working, with `assemble` writing a tree.
- **0001's freeze gets cleaner, not messier**: it freezes a path-addressed,
  tree-loading surface that is more idiomatic Go (`fs.FS`) and more idiomatic
  shell (`cat`/`ls`) than what it would have frozen.

## Migration

- **`digest.json` → tree is a keyless, deterministic explosion.** A one-shot
  `ask digest migrate` reads the committed `digest.json` and writes the section
  tree + `_meta.md` + `_glossary/` with no model call — the JSON already holds
  every field the frontmatter needs. This avoids an Opus rebuild purely to
  change format.
- **No external consumers.** Per 0001's audit, nothing outside the repo pins
  the surface yet; the verb rename and load-path change are in-repo only
  (`cmd/ask`, the playground, the site).
- **Gates** (per CLAUDE.md): `go test ./...`, `pnpm test`, `pnpm typecheck`,
  `pnpm --filter hev-ask-site check`, and `ask digest verify` on `site/` after
  the tree lands.

## Sequencing

Docs-first, per the house contract — the user-visible shape is settled in the
docs PR before code moves:

1. **Docs PR (hevask.com)** — rewrite `api/cli.mdx` to the filesystem verbs;
   add/refresh a "digest format" concept page describing the tree and
   frontmatter; update `concepts.mdx`/`tradeoffs.mdx`; CLAUDE.md edits;
   `site/src/lib/docs.ts` nav. Review settles verb names (`facts` vs
   `cat --facts`, `grep` vs `search`) and the frontmatter schema. Nothing below
   starts until this merges.
2. **Build change** — `assemble` writes the tree; per-section `hash` and
   `_meta.md`; incremental distil; `verify` gains tree-integrity checks; `ask
   digest migrate`.
3. **Read change** — `LoadDigest`/`ParseDigest` read a directory/`fs.FS`;
   `command.go` dispatch becomes `tree`/`ls`/`head`/`cat`/`facts`/`grep`;
   path → file resolution.
4. **Virtual module + site** — glob the tree; regenerate `site/.hev-ask/`;
   `ask digest verify` green.
5. **Fold into 0001** — 0001's frozen verb list, `go:embed` story, and
   "committed digest" language are updated to the post-0002 shape before v0.2.0
   tags.

## Open questions

- **`facts <path>` vs `cat --facts`.** A distinct verb is more discoverable and
  keeps `cat` meaning "the prose"; a flag is fewer verbs. Leaning toward the
  verb, since the whole point is that the grounded claims deserve a rung.
- **`grep` vs keeping `search` as an alias.** Rename is cleaner and we are
  early; but `search` is the term in every existing doc and the overlay. Hard
  rename, or one release of alias?
- **`tree` and `ls`, or just `tree`?** `ls <group>` is the scoped listing;
  `tree` is the whole thing. Both is the faithful filesystem answer; `tree`
  alone is smaller. (`tree` is the one an agent reaches for first.)
- **Section file ↔ anchor when a page has many headings.** One file per
  heading-section keeps `cat` precise but multiplies files; the alternative —
  one file per page with sections as `##` and `cat page#anchor` slicing — is a
  closer mirror of the source collection but reintroduces in-file addressing.
  This RFC commits to per-section (small); revisit only if file count bites.
- **Does the manifest stay frontmatter-only, or is a single `_meta.md` enough
  to hold content hash + ordering** without per-file `hash` duplication? Per-
  file `hash` is what makes incremental cheap; `_meta.md` could instead carry
  the full hash map. Frontmatter-everywhere vs one ledger file.
- **`ask digest migrate` lifespan** — ship it, run it once, delete it next
  release, or keep it as a supported `json ↔ tree` converter for anyone
  embedding a legacy digest?

## References

- `0001-embeddable-ask-command.md` — the embed surface this RFC reshapes before
  it freezes; shares the docs-first contract and the v0.2.0 window.
- `pkg/ask/command.go` — the verb dispatch being rewritten; `read.go`,
  `local.go` — the load path; `types.go` — the in-memory types that *survive*.
- `pkg/ask/shard.go` — the per-unit hashing / manifest / valid-only-for-hash
  pattern this RFC extends to per-section granularity.
- `site/src/content/docs/api/cli.mdx` — the CLI reference rewritten to the
  filesystem verbs.
- `site/src/content.config.ts` — the frontmatter schema (`title` required) the
  authored-title rule leans on.
- `CLAUDE.md` — the "committed JSON, hash-gated" and corpus/anchor facts this
  RFC supersedes or preserves.
- RFC 0003 (follow-on, MCP-as-hydrate) — consumes this artifact: one tool that
  ships the whole (compressible) tree to local disk + `instructions` that teach
  the ladder and citation; `answer` reframed overlay-only.
