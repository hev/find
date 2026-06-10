---
id: "concepts#host-neutral-one-digest-any-framework"
title: "Concepts"
heading: "Host-neutral: one digest, any framework"
group: "Overview"
order: 63
url: "/docs/concepts#host-neutral-one-digest-any-framework"
anchor: "host-neutral-one-digest-any-framework"
terms: ["host","neutral","digest","framework","build","never","touches","renderer","reads","markdown","chunks","headings","derives","anchors","code","artifact","identical","across","astro","docusaurus","vitepress","mkdocs","only","adapter","differs","batteries","included","integration","versus","primitives","elsewhere","static","drop","overlay","keyword","search","hostable","endpoint","agentic","answers"]
hash: "b670f196f7770314128233d4a8ce13b0b168f901639a3697bcaf9c119bc1a17a"
mode: "agent-primary"
facts: [{"kind":"code","literal":".hev-ask/","chunkId":"concepts#host-neutral-one-digest-any-framework"},{"kind":"code","literal":"hevAsk()","chunkId":"concepts#host-neutral-one-digest-any-framework"},{"kind":"code","literal":"astro build","chunkId":"concepts#host-neutral-one-digest-any-framework"},{"kind":"code","literal":"/api/ask","chunkId":"concepts#host-neutral-one-digest-any-framework"},{"kind":"code","literal":"SearchOverlay.astro","chunkId":"concepts#host-neutral-one-digest-any-framework"},{"kind":"code","literal":"\u003cscript\u003e","chunkId":"concepts#host-neutral-one-digest-any-framework"},{"kind":"code","literal":"tree","chunkId":"concepts#host-neutral-one-digest-any-framework"},{"kind":"code","literal":"cat","chunkId":"concepts#host-neutral-one-digest-any-framework"},{"kind":"code","literal":"grep","chunkId":"concepts#host-neutral-one-digest-any-framework"}]
sources: [{"chunkId":"concepts#host-neutral-one-digest-any-framework","url":"/docs/concepts#host-neutral-one-digest-any-framework","anchor":"host-neutral-one-digest-any-framework"}]
---

The digest build never touches a renderer — it reads markdown, chunks on headings, derives anchors in code — so the artifact is identical across Astro, Docusaurus, VitePress, and MkDocs. Only the adapter differs: Astro's batteries-included integration, versus two host-neutral primitives elsewhere (the static drop-in overlay for keyword search and the hostable endpoint for agentic answers). The CLI and MCP read the tree directly on any host.
