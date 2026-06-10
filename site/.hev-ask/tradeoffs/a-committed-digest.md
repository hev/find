---
id: "tradeoffs#a-committed-digest"
title: "Tradeoffs"
heading: "A committed digest"
group: "Overview"
order: 100
url: "/docs/tradeoffs#a-committed-digest"
anchor: "a-committed-digest"
terms: ["committed","digest","committing","buys","section","review","runtime","determinism","free","reads","model","call","request","path","edge","bundling","without","filesystem","access","direct","agent","navigation","cost","staleness","only","regenerates","content","changes","build","runs","warning","hash","gate","makes","rebuild","every","change","cheap","intended","workflow"]
hash: "110adfc68831d0e1a9dcd3844ea876fb7fbd211e79537b3c2e854618aaecdc8d"
mode: "agent-primary"
facts: [{"kind":"code","literal":"tree","chunkId":"tradeoffs#a-committed-digest"},{"kind":"code","literal":"cat","chunkId":"tradeoffs#a-committed-digest"},{"kind":"code","literal":"grep","chunkId":"tradeoffs#a-committed-digest"}]
sources: [{"chunkId":"tradeoffs#a-committed-digest","url":"/docs/tradeoffs#a-committed-digest","anchor":"a-committed-digest"}]
---

Committing the digest to git buys per-section PR review, runtime determinism, free reads with no model call on the request path, edge bundling without filesystem access, and direct agent navigation. The cost is staleness: it only regenerates when content changes and a build runs, with a runtime warning as the cue — and the per-section hash gate makes rebuild-in-CI on every change the cheap, intended workflow.
