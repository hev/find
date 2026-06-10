// The digest is a directory: how it's built, what it is, and the three ways it's read.
export const askMapDiagram = String.raw`  ask digest build
      glob collections → chunk by headings → distil each section (Opus 4.8)
      one markdown file per section · hash-gated, incremental
      │
      ▼
  .hev-ask/                a committed, distilled mirror of your docs
  ├─ _meta.md              overview · context · suggestions · content hash
  ├─ _glossary/
  │  └─ digest.md          a term · its aliases · its definition
  ├─ overview/
  │  ├─ quick-start.md     one markdown + frontmatter file per section:
  │  └─ limits.md          title · summary · body · facts · url#anchor
  └─ api/
     └─ cli.md
      │
      ▼
  read three ways
  ├─ ⌘K overlay · humans   keyword search + a grounded answer · synthesis
  ├─ ask CLI    · agents   tree · ls · head · cat · facts · grep · keyless
  └─ ask mcp    · agents   one tool hydrates the tree; the agent reads it`;

// Progressive disclosure expressed as a directory: four rungs, each a larger slice of one file.
export const askLadderDiagram = String.raw`  progressive disclosure as a directory — each verb a larger slice of one section

  tree · ls      ▸  titles only, the whole map          ·  cheap, safe to skim first
       │
       ▼
  head <path>    ▸  title + one-line summary            ·  bounded, the decision rung
       │
       ▼
  cat <path>     ▸  the full distilled section body     ·  opt-in
       │
       ▼
  facts <path>   ▸  verbatim flags / code / identifiers ·  grounded literals + url#anchor
                    + sources + terms                     to cite back to the live page`;

// What the reader experiences at the overlay.
export const askFlowDiagram = String.raw`           type a query                    press Enter
                 │                               │
                 ▼                               ▼
      ┌───────────────────┐            ┌─────────────────┐
      │ keyword           │            │ agentic loop    │
      │ instant · keyless │            │ search → answer │
      └───────────────────┘            │ needs API key   │
                 │                     └─────────────────┘
                 ▼                               │
      ┌───────────────────┐                      ▼
      │ section results   │        ┌──────────────────────────┐
      │ /docs/page#anchor │        │ streamed answer with     │
      └───────────────────┘        │ inline /docs/page#anchor │
                                   └──────────────────────────┘`;
