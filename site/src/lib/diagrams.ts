// Build-time vs runtime: where each part of hev ask does its work.
export const askMapDiagram = String.raw`        BUILD TIME (Node, fs)                      RUNTIME (edge)
  ╔═══════════════════════════════╗        ╔══════════════════════════════════╗
  ║  hev-ask-kg build            ║░       ║  /api/ask  (on demand)          ║░
  ║                               ║░       ║                                  ║░
  ║  glob src/content/docs/**     ║░       ║  ┌── keyword mode (no key) ──┐   ║░
  ║   → chunk by heading          ║░       ║  │ prefilter chunks + glossary│   ║░
  ║   → sha256 hash; skip if same ║░       ║  └────────────────────────────┘   ║░
  ║   → Opus 4.8 builds the graph ║░       ║  ┌── agentic loop (Haiku) ───┐    ║░
  ║   → write .hev-ask/kg.json   ║░──┐    ║  │ system: kg.context (cached)│    ║░
  ║                               ║░  │    ║  │ tool: search(q)  ≤ N times │    ║░
   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  commit ║  │ then stream answer (no tool)│   ║░
                                      │    ║  │ grounded in page#anchor    │    ║░
  virtual:hev-ask/kg  ◀── bundles ───┘    ║  └────────────────────────────┘   ║░
                                           ╚══════════════════════════════════╝░
                                            ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░`;

// What the reader experiences at the overlay.
export const askFlowDiagram = String.raw`   type a query                press Enter
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
