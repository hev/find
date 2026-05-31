// Build-time vs runtime: where each part of hev find does its work.
export const findMapDiagram = String.raw`        BUILD TIME (Node, fs)                      RUNTIME (edge)
  ╔═══════════════════════════════╗        ╔══════════════════════════════════╗
  ║  hev-find-kg build            ║░       ║  /api/find  (on demand)          ║░
  ║                               ║░       ║                                  ║░
  ║  glob src/content/docs/**     ║░       ║  ┌── keyword mode (no key) ──┐   ║░
  ║   → chunk by heading          ║░       ║  │ prefilter chunks + glossary│   ║░
  ║   → sha256 hash; skip if same ║░       ║  └────────────────────────────┘   ║░
  ║   → Opus 4.8 builds the graph ║░       ║  ┌── agentic loop (Haiku) ───┐    ║░
  ║   → write .hev-find/kg.json   ║░──┐    ║  │ system: kg.context (cached)│    ║░
  ║                               ║░  │    ║  │ tool: search(q)  ≤ N times │    ║░
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  commit ║  │ then stream answer (no tool)│   ║░
                                      │    ║  │ grounded in page#anchor    │    ║░
  virtual:hev-find/kg  ◀── bundles ───┘    ║  └────────────────────────────┘   ║░
                                           ╚══════════════════════════════════╝░
                                            ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░`;

// What the reader experiences at the overlay.
export const findFlowDiagram = String.raw`   type a query                press Enter
        │                            │
        ▼                            ▼
  ┌────────────┐             ┌────────────────┐
  │  keyword   │             │  agentic loop  │
  │  instant   │             │ search → answer│
  │  keyless   │             │  needs API key │
  └─────┬──────┘             └───────┬────────┘
        │                            │
        ▼                            ▼
  ┌──────────────────┐   ┌──────────────────────────┐
  │  section results │   │  streamed answer with     │
  │  /docs/page#anchor│   │  inline /docs/page#anchor │
  └──────────────────┘   └──────────────────────────┘`;
