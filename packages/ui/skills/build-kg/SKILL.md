---
name: build-kg
description: >-
  Build the @hev/ask knowledge graph (.hev-ask/kg.json) for an Astro docs site
  using your Claude Code subscription instead of an ANTHROPIC_API_KEY. Use when
  the user asks to build, rebuild, or refresh the hev ask knowledge graph, KG,
  or search index, or after docs content changes. Runs `ask kg corpus`,
  writes the distillation, and runs `ask kg assemble`.
---

# Build the hev ask knowledge graph

`@hev/ask` searches an Astro docs site. Its agentic loop, keyword ranking, and
suggested questions are powered by a committed knowledge graph at
`.hev-ask/kg.json`. Only the **distillation** of that graph needs a model — the
node structure, verbatim facts, overview map, and content hash are computed
deterministically by the CLI. This skill performs that distillation here, in the
user's subscription, so it costs **no API tokens on their own key**.

Run every command from the **site root** (the directory whose `astro.config.*`
registers `hevAsk()` — usually where `src/content/` lives). Prefer
`pnpm exec ask kg …`; fall back to `npx -p @hev/ask ask kg …` if pnpm isn't used.

## Steps

1. **Emit the corpus.**

   ```sh
   pnpm exec ask kg corpus --out .hev-ask/kg-input.json
   ```

   This is deterministic and keyless. It writes `.hev-ask/kg-input.json`.

2. **Check freshness.** Read `.hev-ask/kg-input.json`. If `"upToDate": true`,
   the committed graph already matches the content — **stop here** and tell the
   user nothing needs rebuilding. Otherwise continue.

3. **Distil.** The file has a `sections` array; each entry is
   `{ id, url, title, text }`. Write a distillation to
   `.hev-ask/kg-distill.json` with exactly this shape:

   ```json
   {
     "context": "Compact markdown orientation: what the product is, its core concepts and feature areas, and how users talk about them.",
     "glossary": [
       { "term": "knowledge graph", "aliases": ["kg"], "definition": "One-line definition." }
     ],
     "summaries": [
       { "id": "<exact section id from sections>", "summary": "1–3 sentence distillation." }
     ],
     "suggestions": [
       "A natural question a reader might type that these docs answer."
     ]
   }
   ```

   Rules:
   - Emit **one `summaries` entry for every `id`** in `sections` — no more, no
     fewer. Use the exact id strings.
   - Summaries are what the search agent reasons from: faithful, self-contained,
     1–3 sentences. **Paraphrase prose, but never restate code, flags, commands,
     or exact identifiers** — those are extracted verbatim by the CLI and would
     only drift if you retyped them.
   - `glossary` aliases are the terms real users would type (`k8s` for
     `kubernetes`). Keep definitions to one line.
   - `suggestions`: 3–5 questions phrased the way a user would ask them, each
     genuinely answerable from these docs.

4. **Assemble.**

   ```sh
   pnpm exec ask kg assemble --input .hev-ask/kg-distill.json
   ```

   This re-chunks the content, extracts facts, builds the overview and nodes
   deterministically, and writes `.hev-ask/kg.json`.

5. **Verify (optional but recommended).**

   ```sh
   pnpm exec ask kg verify
   ```

   Anchor drift is fatal; coverage/fidelity warnings are informational.

6. **Clean up and commit.** Delete the intermediates and commit the graph:

   ```sh
   rm -f .hev-ask/kg-input.json .hev-ask/kg-distill.json
   git add .hev-ask/kg.json
   ```

   Only `.hev-ask/kg.json` is committed; the input/distill files are scratch.

## Notes

- Pass the same content flags the site's integration uses if they differ from
  the defaults (`--collection`, `--base-path`, `--chunk-heading-depth`,
  `--content-glob`, `--kg-path`). They must match across `corpus` and `assemble`.
- If `corpus` fails because no content is found, you're likely not in the site
  root, or the collection name isn't `docs` — pass `--collection <name>`.
