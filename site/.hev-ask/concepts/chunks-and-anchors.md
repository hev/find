---
id: "concepts#chunks-and-anchors"
title: "Concepts"
heading: "Chunks and anchors"
group: "Overview"
order: 61
url: "/docs/concepts#chunks-and-anchors"
anchor: "chunks-and-anchors"
terms: ["chunks","anchors","documents","split","headings","configurable","depth","section","whose","urls","carry","real","generated","github","slugger","matching","astro","flavored","renderers","emit","other","adapters","declare","their","slug","schemes","both","offline","build","runtime","index","chunk","through","same","function","agree","because","reads","files","rather"]
hash: "7114c39ed148b671179972b86fbdceaa60d0146af253d0bf66722359e2522155"
mode: "agent-primary"
facts: [{"kind":"code","literal":"##","chunkId":"concepts#chunks-and-anchors"},{"kind":"code","literal":"###","chunkId":"concepts#chunks-and-anchors"},{"kind":"code","literal":"basePath + slug + #anchor","chunkId":"concepts#chunks-and-anchors"},{"kind":"code","literal":"github-slugger","chunkId":"concepts#chunks-and-anchors"},{"kind":"code","literal":"{#custom-id}","chunkId":"concepts#chunks-and-anchors"},{"kind":"code","literal":"getCollection","chunkId":"concepts#chunks-and-anchors"},{"kind":"value","literal":"github.com","chunkId":"concepts#chunks-and-anchors"}]
sources: [{"chunkId":"concepts#chunks-and-anchors","url":"/docs/concepts#chunks-and-anchors","anchor":"chunks-and-anchors"}]
---

Documents are split on headings up to a configurable depth into section chunks whose URLs carry real anchors generated with github-slugger, matching what Astro and GitHub-flavored renderers emit; other adapters declare their own slug schemes. Both the offline build and the runtime index chunk through the same function, so anchors agree — and because the build reads files rather than a renderer, the digest is framework-independent.
