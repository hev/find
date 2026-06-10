---
id: "digest-creation#built-from-markdown-not-from-a-renderer"
title: "Digest creation"
heading: "Built from markdown, not from a renderer"
group: "Overview"
order: 71
url: "/docs/digest-creation#built-from-markdown-not-from-a-renderer"
anchor: "built-from-markdown-not-from-a-renderer"
terms: ["built","markdown","renderer","build","never","imports","framework","reads","files","chunks","headings","derives","anchors","code","producing","same","artifact","none","only","timing","differs","host","astro","integration","runs","during","site","present","elsewhere","step","overlay","wiring","sites","separate","smaller","writes","tree","comes","whether","docusaurus"]
hash: "473b58f15073f724b5961c7a62a2f9f09cabd49ec8b8e42e7d692e7ae6ec4461"
mode: "agent-primary"
facts: [{"kind":"code","literal":"astro build","chunkId":"digest-creation#built-from-markdown-not-from-a-renderer"}]
sources: [{"chunkId":"digest-creation#built-from-markdown-not-from-a-renderer","url":"/docs/digest-creation#built-from-markdown-not-from-a-renderer","anchor":"built-from-markdown-not-from-a-renderer"}]
---

The build never imports a framework — it reads files, chunks on headings, and derives anchors in code, producing the same artifact on any renderer or none. Only the timing differs per host: the Astro integration runs it during the site build when a key is present; elsewhere it's a build or CI step. Overlay wiring on non-Astro sites is a separate, smaller job.
