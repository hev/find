---
name: build-digest
description: >-
  Build the @hevmind/ask ask digest (.hev-ask/digest.json) for an Astro docs site
  using your Claude Code subscription instead of an ANTHROPIC_API_KEY. Use when
  the user asks to build, rebuild, or refresh the hev ask digest, knowledge
  graph, KG, or search index, or after docs content changes. Runs `ask digest
  corpus --shards-dir`, distils each shard in a fresh context, and runs
  `ask digest assemble --input-dir`.
---

# Build the hev ask digest

`@hevmind/ask` searches an Astro docs site. Its agentic loop, keyword ranking, and
suggested questions are powered by a committed ask digest at
`.hev-ask/digest.json`. Only the **distillation** needs a model — the node
structure, verbatim facts, overview map, and content hash are computed
deterministically by the CLI. This skill performs that distillation here, in
the user's subscription, so it costs **no API tokens on their own key**.

The corpus is split into **shards** (~200KB of text each, along slug-prefix
boundaries) and each shard is distilled in its own fresh context. Corpus size
is therefore never a context-limit problem — a bigger site just means more
shards. All state lives on disk in `.hev-ask/shards/`, so the build can be
stopped, resumed, and incrementally refreshed: after content edits, only the
shards whose content changed need re-distilling.

Run every command from the **site root** (the directory whose `astro.config.*`
registers `hevAsk()`). Prefer `pnpm exec ask digest …`; fall back to
`npx -p @hevmind/ask ask digest …` if pnpm isn't used. Pass the same content flags
the site's integration uses if they differ from the defaults (`--collection`,
`--base-path`, `--chunk-heading-depth`, `--content-glob`, `--digest-path`);
they must match across `corpus` and `assemble`.

**Never read a shard input file into the orchestrating context** (they hold
the full corpus text). The orchestrator works only from command output,
`manifest.json`, and `status`; shard contents are read by the per-shard
distillation agents.

## Steps

1. **Shard the corpus.**

   ```sh
   pnpm exec ask digest corpus --shards-dir .hev-ask/shards
   ```

   Deterministic and keyless. Writes one `input-<shard-id>.json` per shard
   plus `manifest.json`, and reports `(N sections, M shards, P pending,
   up-to-date|needs-rebuild)`. Re-running after content edits is safe and is
   the refresh mechanism: unchanged shards keep their distillations; changed
   ones are marked pending again.

2. **Check state.** If the corpus reported `up-to-date` AND `0 pending`, the
   committed digest already matches the content — **stop here** and tell the
   user nothing needs rebuilding. Otherwise:

   ```sh
   pnpm exec ask digest status --shards-dir .hev-ask/shards
   ```

   lists which shards are `pending` or `stale` (distilled against older
   content). Both need distilling.

3. **Distil each pending/stale shard in a fresh context.** Spawn one agent per
   shard (run a few in parallel; don't read shard contents yourself). Each
   agent gets this prompt, with `<id>` filled in:

   > Read ONLY `.hev-ask/shards/input-<id>.json` (from the site root). It has
   > `shardId`, `shardHash`, and a `sections` array of `{ id, url, title,
   > text }`. Write `.hev-ask/shards/distill-<id>.json` with exactly this
   > shape:
   >
   > ```json
   > {
   >   "shardHash": "<copy the shardHash from the input file verbatim>",
   >   "notes": "5-10 lines: what this shard covers, its key concepts, and how users talk about them.",
   >   "glossary": [
   >     { "term": "ask digest", "aliases": ["digest", "kg"], "definition": "One-line definition." }
   >   ],
   >   "summaries": [
   >     { "id": "<exact section id from sections>", "summary": "1-3 sentence distillation." }
   >   ]
   > }
   > ```
   >
   > Rules:
   > - Emit **one `summaries` entry for every `id`** in `sections` — no more,
   >   no fewer. Use the exact id strings.
   > - Summaries are what the search agent reasons from: faithful,
   >   self-contained, 1-3 sentences. **Paraphrase prose, but never restate
   >   code, flags, commands, or exact identifiers** — those are extracted
   >   verbatim by the CLI and would only drift if you retyped them.
   > - `glossary`: at most the ~10 terms from this shard a real user would
   >   type (aliases like `k8s` for `kubernetes`); one-line definitions. The
   >   CLI dedupes and caps the merged glossary.
   > - `notes` is NOT user-facing — it feeds a later site-wide synthesis pass.
   > - Your final message: just the shard id and how many summaries you wrote.

   If the run is interrupted, just re-run from step 1 — disk state is the
   source of truth and `status` shows what's left.

4. **Synthesize the global context.** Once every shard is distilled, extract
   only the `notes` fields (small) — never the full distill files:

   ```sh
   python3 -c "import json,glob; [print('##', f.split('distill-')[1].removesuffix('.json'), '\n' + json.load(open(f)).get('notes','')) for f in sorted(glob.glob('.hev-ask/shards/distill-*.json'))]"
   ```

   From those notes, write `.hev-ask/shards/global.json`:

   ```json
   {
     "context": "Compact markdown orientation: what the product/site is, its core concepts and feature areas, and how users talk about them.",
     "suggestions": [
       "A natural question a reader might type that these docs answer."
     ],
     "glossary": []
   }
   ```

   `suggestions`: 3-5 questions phrased the way a user would ask them, each
   genuinely answerable from these docs (they show in the overlay on open).

5. **Assemble.**

   ```sh
   pnpm exec ask digest assemble --input-dir .hev-ask/shards
   ```

   Merges every current shard distillation with the global synthesis, derives
   the deterministic parts, and writes `.hev-ask/digest.json`. Sections from
   undistilled shards fall back to plain excerpts and are reported — the
   digest stays usable mid-wave, but aim for 0 pending before committing.

6. **Verify.**

   ```sh
   pnpm exec ask digest verify
   ```

   Anchor drift is fatal; coverage/fidelity warnings are informational.

7. **Clean up and commit.** The shards directory is a local cache — it is the
   resume/refresh state, so keep it on disk but out of git, and drop the bulky
   input files (regenerated by `corpus` any time):

   ```sh
   rm -f .hev-ask/shards/input-*.json
   git check-ignore -q .hev-ask/shards || echo ".hev-ask/shards/" >> .gitignore
   git add .gitignore .hev-ask/digest.json
   ```

   Only `.hev-ask/digest.json` is committed.

## Notes

- A small site may produce a single shard; the flow is the same (you can
  distil it yourself instead of spawning an agent — a single shard's input is
  small enough to read directly).
- `--shard-bytes` (default 200000) tunes shard size if a site's sections are
  unusually dense.
- If `corpus` fails because no content is found, you're likely not in the
  site root, or the collection name isn't `docs` — pass `--collection <name>`.
