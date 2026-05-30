# Implementation Plan: hev find v2

Turn the single-shot **re-ranker** into a three-part system: an offline
knowledge graph (Opus 4.8), a heading-chunk index with real anchors, and a
bounded agentic search loop that decides its own sub-queries and ranks
independently.

> **Naming:** the tool is branded **hev find** (consistent with hevlayer /
> hevmind). This plan uses the post-rename identifiers throughout. Rename map
> (several are public/breaking and must be updated in the consuming `layer` site
> too):
>
> | Current | → hev find |
> |---|---|
> | monorepo `astro-agentic-search-monorepo` | `hev-find` |
> | package `@hev/astro-agentic-search` | `@hev/find` |
> | default export `agenticSearch()` | `hevFind()` |
> | endpoint default `/api/agentic-search` | `/api/find` |
> | virtual module `virtual:agentic-search/*` | `virtual:hev-find/*` |
> | consumer attr `data-agentic-search-open` | `data-hev-find-open` |
> | localStorage key `agentic-search:mode` | `hev-find:mode` |
> | footer "Agent search by hev" | "hev find" |
> | log/error prefix `[agentic-search]` | `[hev-find]` |
> | CSS class prefix `as-` | unchanged (cosmetic) |
>
> Folded into step 6 of the sequencing so these identifiers are touched once.

## Decisions locked in

- **Search UX:** instant keyword-as-you-type (keyless); the agentic loop fires
  on **Enter**.
- **Knowledge graph:** generated at build time by **Opus 4.8**, committed to git
  as a reviewable JSON artifact, hash-gated so it only regenerates when content
  changes.
- **Deep links:** index is chunked by heading; a result *is* an anchor
  (`page#section`), not just a page.
- **Corpus:** the configured Astro content collection(s) only.
- **Loop model:** configurable, default **Haiku 4.5**.
- **KG usage:** both — context table injected into the system prompt
  (prompt-cached) *and* glossary used to expand query terms before retrieval.
- **Retrieval:** dependency-free keyword token-overlap over chunks, widened by
  glossary synonyms (no embeddings).
- **Iteration cap:** ~3–4 searches per query.

## 1. Goal & shape of the change

| Part | When | Model | Output |
|---|---|---|---|
| **Knowledge Graph build** | offline / build-time | Opus 4.8 | committed `kg.json` (context table + glossary) |
| **Heading-chunk index** | server cold start | none | in-memory chunk index with anchor URLs |
| **Agentic search loop** | per submitted query | Haiku 4.5 (configurable) | independently-ranked, anchor-deep-linked results |

```
                    BUILD TIME (Node, fs)                         RUNTIME (edge)
  ┌───────────────────────────────────────┐        ┌──────────────────────────────────┐
  │ kg/build.ts  (bin: kg:build)           │        │ endpoint.ts                       │
  │  glob src/content/docs/**.mdx          │        │  ┌── keyword mode (no key) ──┐     │
  │   → chunk.ts → cleaned corpus          │        │  │ prefilter(chunks)+glossary│     │
  │   → hash; skip if unchanged            │        │  └───────────────────────────┘     │
  │   → Opus 4.8 emit_knowledge_graph      │        │  ┌── agentic loop (Haiku) ───┐     │
  │   → write <site>/.hev-find/kg.json│  ───▶ │  │ system: KG.context (cached)│     │
  └───────────────────────────────────────┘ commit │  │ tool: search(q) ≤ N times  │     │
                                                    │  │ tool: present_results      │     │
  virtual:hev-find/kg  ◀── bundles kg.json ──▶│  │ id→chunk→page#anchor       │     │
                                                    │  └───────────────────────────┘     │
                                                    └──────────────────────────────────┘
```

## 2. New & changed files

```
packages/ui/src/
  kg/
    schema.ts        NEW  KnowledgeGraph / GlossaryEntry types + EMPTY_KG
    build.ts         NEW  Opus build routine (hash-gated, structured tool call)
    cli.ts           NEW  bin entry: `hev-find-kg build`  (pnpm kg:build)
    frontmatter.ts   NEW  ~20-line flat-YAML frontmatter splitter (disk path)
    expand.ts        NEW  glossary-driven query-term expansion
  search/
    chunk.ts         NEW  chunkDocument() → heading chunks + github-slug anchors
    index.ts         EDIT buildIndex → Chunk[]; prefilter over chunks + per-doc cap
  llm.ts             EDIT cache_control on system blocks; larger maxTokens; loop helper
  endpoint.ts        EDIT keyword branch → chunk results; agentic branch → tool loop
  integration.ts     EDIT 2nd virtual module (kg); astro:build:start hook; new options
  types.ts           EDIT new options + ResolvedConfig fields
  components/
    SearchOverlay.astro  EDIT Enter=submit-AI model; progress states; anchor/heading row
  package.json       EDIT add `github-slugger` dep; add `bin`; export ./endpoint stays
```

One deliberate dependency exception: **add `github-slugger`** (≈3 KB, pure JS,
edge-safe) to guarantee byte-identical anchors with Astro's renderer. Anchor
correctness outranks the zero-dep aesthetic; call this out in the README.

## 3. Data shapes

```ts
// search/chunk.ts
interface Chunk {
  id: string;          // `${docSlug}#${anchorId}` or `${docSlug}` for the intro chunk
  docSlug: string;
  docTitle: string;
  group?: string;
  heading?: string;    // the section heading text (undefined for intro chunk)
  anchorId?: string;   // github-slug; undefined for intro
  url: string;         // page URL, with #anchorId appended when present
  text: string;        // cleaned section prose (heading + body until next heading)
  tokens: Set<string>;
}

// kg/schema.ts
interface GlossaryEntry { term: string; aliases: string[]; definition: string }
interface KnowledgeGraph {
  version: 1;
  generatedAt: string;       // stamped by the build script (Node Date — build, not edge)
  contentHash: string;       // sha256 of concatenated chunk text → staleness gate
  context: string;           // compact markdown domain orientation (system-prompt payload)
  glossary: GlossaryEntry[];
}
const EMPTY_KG: KnowledgeGraph = { version:1, generatedAt:'', contentHash:'', context:'', glossary:[] };
```

## 4. Chunking & anchors (`search/chunk.ts`)

- Split each doc body on headings up to `chunkHeadingDepth` (default 3 →
  `##`,`###`). Content before the first heading is the **intro chunk** (URL =
  page, no anchor).
- Per document, use **one `GithubSlugger` instance** so duplicate headings get
  the same `-1/-2` suffixes Astro produces (matching its renderer's dedup).
- `cleanMarkdown` (existing) is reused on each section's text.
- `url = toUrl(docSlug) + (anchorId ? '#'+anchorId : '')`.
- Both code paths call this: runtime `buildIndex` feeds it `getCollection`
  entries; the build script feeds it disk-parsed `{slug,title,group,body}`.
  Single source of truth for slugs.

**Verification hook (mechanical):** a `kg:verify` script builds the site and
asserts every chunk's `#anchorId` exists as an `id=` in the matching
`dist/docs/.../index.html`. Catches slug drift before it ships a 404-to-top link.

## 5. Index & prefilter (`search/index.ts`)

- `buildIndex` returns `Chunk[]` (was doc entries).
- `prefilter(chunks, query, glossary, pool, perDocCap)`:
  - Expand query terms via `expand.ts`: for each term, add glossary aliases
    (`k8s`→`kubernetes`) and the matched glossary term's own tokens. Additive
    and capped.
  - Score token overlap per chunk; sort; apply `perDocCap` (default 2) so one
    page can't monopolize results; take `pool`.
  - Excerpt around first matched term (existing `excerpt`).

## 6. The agentic loop (`endpoint.ts`)

Replace the single agentic call with a bounded tool-use loop.

**System prompt** (built once, prompt-cached):
```
You are the search engine for {siteName}. Find the documentation sections
that best answer the user's query.

<domain_context>
{KG.context}            ← cache_control: ephemeral
</domain_context>

You decide how many searches to run (max {maxIterations}). Issue focused
sub-queries with the `search` tool — vary terms, try synonyms, decompose
multi-part questions. When you have enough, call `present_results` with the
best sections ordered best-first, each with a one-sentence snippet. You are a
results generator, not a chat assistant: never answer the question directly.
```

**Tools:**
- `search({ query })` → server runs glossary-expanded `prefilter`, returns
  `[{ id, docTitle, heading, snippet }]` for fresh (unseen) chunks; accumulates
  a `byId` pool across calls.
- `present_results({ results: [{ id, snippet }] })` → forced terminal; `id` must
  be one surfaced by a prior `search`.

**Loop control:**
```
messages = [user query]
seen = Map()
for i in 0..maxIterations:
    resp = callClaude(system, messages, tools, tool_choice: i==last ? present_results : auto)
    append assistant content to messages
    for each tool_use:
       if search:  run prefilter, merge into seen, append tool_result(candidates)
       if present_results: pick = input.results; break loop
    if no tool_use: break
if no present_results emitted: one final forced call with tool_choice=present_results
```
- `maxIterations` default **4** (3–4 searches as chosen).
- Map `pick[].id` → `seen` chunk → `{ title: docTitle, heading, url: page#anchor,
  group, snippet }`; dedup by `url`; slice `maxResults`.
- Response also returns `searches: string[]` (the sub-queries run) so the
  overlay can show "searched: autoscaling, control loops".
- Errors / no key → same graceful JSON as today.

**`llm.ts` edits:** accept `system` as string *or* block array with
`cache_control`; raise `maxTokens` ceiling; everything else (zero-dep fetch)
unchanged. The loop lives in `endpoint.ts` and just calls `callClaude` repeatedly
with grown `messages`.

## 7. Knowledge-graph build (`kg/build.ts` + `cli.ts`)

Runs in Node (fs access), invoked by `pnpm kg:build` and chained before
`astro build`.

1. Resolve content files from disk via `kgContentGlobs` (default
   `src/content/<collection>/**/*.{md,mdx}`).
2. Parse frontmatter (`kg/frontmatter.ts`), chunk via shared `chunk.ts`.
3. `contentHash = sha256(chunks.text.join())`. If an existing `kg.json` has the
   same hash → **exit 0, no Opus spend** (the freshness gate).
4. Else call **Opus 4.8** once: full cleaned corpus in a `cache_control` system
   block, forced `emit_knowledge_graph` tool returning `{ context, glossary }`.
   Opus produces (a) a compact orientation of the product, its subsystems and
   how they relate, and (b) a glossary with aliases/synonyms keyed to terms an
   end user would actually type.
5. Write `<site>/.hev-find/kg.json` (path configurable via `kgPath`),
   stamped with `generatedAt`/`contentHash`. **Committed to git** → reviewable.

Corpus is ~16 docs → fits one call. For a future large corpus the builder
map-reduces (per-doc summaries → merge) — noted as a follow-up, not built now.

## 8. Integration wiring (`integration.ts`)

- **Second virtual module** `virtual:hev-find/kg`: at config-setup it reads
  the committed `kg.json` and inlines it (`export default {...}`); if absent,
  exports `EMPTY_KG`. Bundles the KG into the Cloudflare worker (no runtime fs).
- **`astro:build:start` hook**: if `ANTHROPIC_API_KEY` present, run the KG build
  (hash-gated, usually a no-op). If absent, log a warning and proceed with the
  committed artifact — **build never fails for lack of a key.**
- **`bin`** in package.json → `hev-find-kg` for manual/CI runs.

## 9. Overlay UX (`SearchOverlay.astro`)

- **While typing:** debounced **keyword** search over chunks — instant, keyless,
  anchored. First row auto-active. Footer hint: `⏎ ask AI · ↑↓ open`.
- **Enter:** if the user has explicitly moved the selection (pressed ↑/↓ or
  hovered) → open the active result; otherwise → **run the agentic loop**. So
  "type → Enter" = AI search, and "type → ↓↓ → Enter" = open a keyword hit.
  Tracked via a `userSelected` flag.
- **Progress:** stepped loader (`Searching…` → `Ranking…`); on completion, render
  AI results and a faint `searched: …` line from the response's `searches[]`. No
  SSE needed.
- **Results rendering:** existing row markup; add an optional `heading`
  breadcrumb (`Concepts › Kubernetes autoscaling`). `a.href` already consumes
  `r.url`, which now carries `#anchor` — no navigation change needed.
- **Mode toggle:** kept; now means "AI on Enter" on/off, persisted in
  `localStorage` as today.

## 10. New config surface (`types.ts` / `integration.ts`)

```ts
model?: string             // loop model            default 'claude-haiku-4-5'
kgModel?: string           // build model           default 'claude-opus-4-8'
maxIterations?: number     // search rounds          default 4
chunkHeadingDepth?: number // 2=##, 3=##+###          default 3
candidatePerSearch?: number// chunks per search tool default 8
perDocCap?: number         // chunks/doc in prefilter default 2
maxResults?: number        // shown to user          default 6
kgPath?: string            // committed artifact     default '.hev-find/kg.json'
kgContentGlobs?: string[]  // build-time source       default derived from collections
collections, endpoint, basePath  // unchanged
```

## 11. Degradation & freshness (explicit)

- **No key at build** → keep committed `kg.json`, warn. **No `kg.json` at all** →
  `EMPTY_KG`; agentic loop still runs, just without domain context/glossary.
- **No key at runtime** → keyword mode only (unchanged from today).
- **Stale KG** → hash gate means it only regenerates when content changes *and* a
  build runs; runtime logs a one-line warning if the live index hash ≠
  `kg.contentHash`, but still serves.

## 12. Verification plan

1. **Anchor parity (mechanical):** `kg:verify` diffs every chunk `#anchorId`
   against `dist/**/*.html` `id=` attributes on the `layer` corpus. Must be 100%.
2. **Chunker unit:** known headings (incl. a duplicate and a `0.1`-style numeric)
   → expected slugs.
3. **Loop integration:** mock `callClaude` to script a 2-search→present sequence;
   assert dedup, `perDocCap`, `maxResults`, and forced-terminal fallback.
4. **Live smoke (`layer` site):** `pnpm kg:build` then dev; query "how does
   autoscaling work" → expect a result landing on
   `…/concepts#kubernetes-autoscaling`; query "k8s scaling" → glossary expansion
   still finds it.
5. `pnpm -r typecheck` clean.

## 13. Suggested sequencing (each step independently testable)

1. `chunk.ts` + `github-slugger` + anchor-parity verifier — proves deep links
   before anything else.
2. `index.ts`/`prefilter` over chunks + keyword-mode chunk results (ship value
   with zero model changes).
3. `kg/` build + `frontmatter.ts` + `expand.ts` + committed artifact + virtual
   module.
4. Agentic loop in `endpoint.ts` + `llm.ts` caching.
5. Overlay UX (Enter-submit + progress + heading breadcrumb).
6. Integration hook, README, defaults, typecheck.

## 14. Risks / open items

- **Anchor slug drift** if Astro changes its slugger — mitigated by the parity
  verifier in CI.
- **Frontmatter parser** is a flat-YAML subset (matches the current schema); swap
  to a real parser if schemas gain nesting.
- **Loop latency** worst case ≈ 4 × Haiku round-trips (~2–4 s). `maxIterations`
  is the knob; keyword stays instant as the fast path.
- **Recall ceiling** is still keyword+glossary retrieval — the agent ranks
  independently but can't rank what retrieval never surfaces. Embeddings remain
  the deferred upgrade if paraphrase recall proves insufficient.
