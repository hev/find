---
id: "api/endpoint#request"
title: "Search endpoint"
heading: "Request"
group: "API"
order: 32
url: "/docs/api/endpoint#request"
anchor: "request"
terms: ["request","search","post","json","body","query","string","optional","mode","keyword","forces","instant","path","agentic","requests","loop","omitting","behaves","like","present","empty","whitespace","queries","return","result","does","autoscaling","work","field","type","description","returns","omitted"]
hash: "f2a05f3dd644d4d9abb081702bbbc0fe721849ccf0e70f59742aea2ae18980a0"
mode: "source-primary"
facts: [{"kind":"code","literal":"{\n  \"query\": \"how does autoscaling work\",\n  \"mode\": \"agentic\"\n}","chunkId":"api/endpoint#request"},{"kind":"code","literal":"POST","chunkId":"api/endpoint#request"},{"kind":"code","literal":"query","chunkId":"api/endpoint#request"},{"kind":"code","literal":"string","chunkId":"api/endpoint#request"},{"kind":"code","literal":"mode","chunkId":"api/endpoint#request"},{"kind":"code","literal":"'keyword' \\| 'agentic'","chunkId":"api/endpoint#request"},{"kind":"code","literal":"keyword","chunkId":"api/endpoint#request"},{"kind":"code","literal":"agentic","chunkId":"api/endpoint#request"}]
sources: [{"chunkId":"api/endpoint#request","url":"/docs/api/endpoint#request","anchor":"request"}]
---

Search is a POST with a JSON body of a query string and an optional mode; keyword forces the instant path, agentic requests the loop, and omitting mode behaves like agentic when a key is present. Empty or whitespace queries return an empty result set.
