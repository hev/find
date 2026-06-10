---
id: "api/search-overlay#the-hostable-endpoint"
title: "SearchOverlay component"
heading: "The hostable endpoint"
group: "API"
order: 53
url: "/docs/api/search-overlay#the-hostable-endpoint"
anchor: "the-hostable-endpoint"
terms: ["hostable","endpoint","agentic","answers","without","astro","bounded","answer","loop","deploys","standalone","service","cloudflare","worker","node","server","vercel","function","serving","same","post","contract","route","holding","side","reading","committed","digest","deploy","once","point","number","sites","keyword","search","runs","entirely","browser","only","needs"]
hash: "de2a87abed98b0710faec2697d9c06ee50122f8ab3852fc8e2133a2af0333886"
mode: "source-primary"
facts: [{"kind":"code","literal":"# scaffold and deploy the Worker flavor\nask endpoint init --target cloudflare\nwrangler deploy            # set ANTHROPIC_API_KEY as a secret","chunkId":"api/search-overlay#the-hostable-endpoint"},{"kind":"code","literal":"POST /api/ask","chunkId":"api/search-overlay#the-hostable-endpoint"},{"kind":"code","literal":"ANTHROPIC_API_KEY","chunkId":"api/search-overlay#the-hostable-endpoint"}]
sources: [{"chunkId":"api/search-overlay#the-hostable-endpoint","url":"/docs/api/search-overlay#the-hostable-endpoint","anchor":"the-hostable-endpoint"}]
---

For agentic answers without Astro, the bounded answer loop deploys as a standalone service (Cloudflare Worker, Node server, or Vercel function) serving the same POST contract as the Astro route, holding the key server-side and reading the committed digest. Deploy once and point any number of sites at it; keyword search runs entirely in the browser, so only the answer loop needs hosting.
