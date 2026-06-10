---
id: "api/endpoint#agentic-response-sse"
title: "Search endpoint"
heading: "Agentic response (SSE)"
group: "API"
order: 25
url: "/docs/api/endpoint#agentic-response-sse"
anchor: "agentic-response-sse"
terms: ["agentic","response","present","mode","endpoint","streams","named","frames","search","events","query","opened","section","single","sources","event","grounding","sent","before","token","clients","validate","links","deltas","markdown","answer","done","frame","error","failures","after","streaming","began","source","carries","title","optional","heading","group","snippet"]
hash: "366017faa11220e7fdd7545cd885b58cdf2133c5f21be853f4339fe775ebc51a"
mode: "source-primary"
facts: [{"kind":"code","literal":"mode","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"agentic","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"content-type: text/event-stream","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"search","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"{ query }","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"sources","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"{ sources: Source[], model, mode }","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"token","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"{ text }","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"done","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"{}","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"error","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"{ error }","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"200","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"Source","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"{ title, heading?, url, group? }","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"snippet","chunkId":"api/endpoint#agentic-response-sse"},{"kind":"code","literal":"url","chunkId":"api/endpoint#agentic-response-sse"}]
sources: [{"chunkId":"api/endpoint#agentic-response-sse","url":"/docs/api/endpoint#agentic-response-sse","anchor":"agentic-response-sse"}]
---

With a key present and agentic mode, the endpoint streams named SSE frames: search events for each sub-query or opened section, a single sources event with the grounding set (sent before any token, used by clients to validate links), token deltas of the Markdown answer, a done frame, and an error frame for failures after streaming began. A source carries title, optional heading and group, and url — no snippet.
