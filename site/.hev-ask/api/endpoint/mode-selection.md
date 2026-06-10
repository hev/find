---
id: "api/endpoint#mode-selection"
title: "Search endpoint"
heading: "Mode selection"
group: "API"
order: 31
url: "/docs/api/endpoint#mode-selection"
anchor: "mode-selection"
terms: ["mode","selection","endpoint","decides","empty","queries","return","keyword","envelope","explicit","missing","returns","json","warning","agentic","requested","otherwise","stream","runs","there","unavailable","error","path","downgrades","results","overlay","branches","response","content","type","query","model","plus","request","says","reader","still","gets","handles","both"]
hash: "268456691571b15ea83b4fb47d86fa28225dcc41a170a2483ba5d5e97a419665"
mode: "source-primary"
facts: [{"kind":"code","literal":"{ results: [], query: \"\", model, mode: \"keyword\" }","chunkId":"api/endpoint#mode-selection"},{"kind":"code","literal":"mode: \"keyword\"","chunkId":"api/endpoint#mode-selection"},{"kind":"code","literal":"mode: \"agentic\"","chunkId":"api/endpoint#mode-selection"},{"kind":"code","literal":"warning","chunkId":"api/endpoint#mode-selection"},{"kind":"code","literal":"content-type","chunkId":"api/endpoint#mode-selection"}]
sources: [{"chunkId":"api/endpoint#mode-selection","url":"/docs/api/endpoint#mode-selection","anchor":"mode-selection"}]
---

The endpoint decides what to run: empty queries return an empty keyword envelope; explicit keyword mode or a missing key returns keyword JSON (with a warning when agentic was requested); otherwise the agentic SSE stream runs. There is no AI-unavailable error path — a missing key downgrades to keyword results, and the overlay branches on the response content-type.
