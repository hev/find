---
id: "api/endpoint#keyword-response-json"
title: "Search endpoint"
heading: "Keyword response (JSON)"
group: "API"
order: 29
url: "/docs/api/endpoint#keyword-response-json"
anchor: "keyword-response-json"
terms: ["keyword","response","json","mode","returns","envelope","ranked","results","title","optional","heading","group","anchor","snippet","plus","echoed","query","configured","loop","model","warning","agentic","request","downgraded","lack","field","deep","link","page","only","intro","chunks","concepts","search","docs","overview","reader","presses","enter","goes"]
hash: "bbc5f7240f935311df97464c2bf6780dc597f246cfa94d8bfd9176bfe72cdd40"
mode: "source-primary"
facts: [{"kind":"code","literal":"{\n  \"results\": [\n    {\n      \"title\": \"Concepts\",\n      \"heading\": \"The agentic search loop\",\n      \"url\": \"/docs/concepts#the-agentic-search-loop\",\n      \"group\": \"Overview\",\n      \"snippet\": \"When the reader presses Enter, the query goes to a bounded loop…\"\n    }\n  ],\n  \"query\": \"how does agentic search work\",\n  \"model\": \"claude-haiku-4-5\",\n  \"mode\": \"keyword\"\n}","chunkId":"api/endpoint#keyword-response-json"},{"kind":"code","literal":"200","chunkId":"api/endpoint#keyword-response-json"},{"kind":"code","literal":"results","chunkId":"api/endpoint#keyword-response-json"},{"kind":"code","literal":"Result[]","chunkId":"api/endpoint#keyword-response-json"},{"kind":"code","literal":"title","chunkId":"api/endpoint#keyword-response-json"},{"kind":"code","literal":"heading?","chunkId":"api/endpoint#keyword-response-json"},{"kind":"code","literal":"url","chunkId":"api/endpoint#keyword-response-json"},{"kind":"code","literal":"group?","chunkId":"api/endpoint#keyword-response-json"},{"kind":"code","literal":"snippet","chunkId":"api/endpoint#keyword-response-json"},{"kind":"code","literal":"query","chunkId":"api/endpoint#keyword-response-json"},{"kind":"code","literal":"string","chunkId":"api/endpoint#keyword-response-json"},{"kind":"code","literal":"model","chunkId":"api/endpoint#keyword-response-json"},{"kind":"code","literal":"mode","chunkId":"api/endpoint#keyword-response-json"},{"kind":"code","literal":"'keyword'","chunkId":"api/endpoint#keyword-response-json"},{"kind":"code","literal":"warning","chunkId":"api/endpoint#keyword-response-json"},{"kind":"code","literal":"string?","chunkId":"api/endpoint#keyword-response-json"},{"kind":"code","literal":"#anchor","chunkId":"api/endpoint#keyword-response-json"}]
sources: [{"chunkId":"api/endpoint#keyword-response-json","url":"/docs/api/endpoint#keyword-response-json","anchor":"keyword-response-json"}]
---

Keyword mode returns a 200 JSON envelope of ranked results (title, optional heading and group, url with anchor, snippet) plus the echoed query, the configured loop model, the mode that ran, and an optional warning when an agentic request was downgraded for lack of a key. The url field is the deep link, page-only for intro chunks.
