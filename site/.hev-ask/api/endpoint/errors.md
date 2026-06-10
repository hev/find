---
id: "api/endpoint#errors"
title: "Search endpoint"
heading: "Errors"
group: "API"
order: 27
url: "/docs/api/endpoint#errors"
anchor: "errors"
terms: ["errors","error","contract","invalid","json","bodies","missing","digest","reads","chunk","index","fails","build","because","agentic","stream","already","failures","arrive","final","event","rather","status","code","body","cause","request","wasn","valid","read","route","glossary","term","section","found","failed","misconfigured","collection","failure","during"]
hash: "c67a8ab9b70204c62cb0ae5f63d37f2d21863e6f4fdc6e684b85e3a81e37ff3d"
mode: "source-primary"
facts: [{"kind":"code","literal":"400","chunkId":"api/endpoint#errors"},{"kind":"code","literal":"{ \"error\": \"Invalid JSON body.\" }","chunkId":"api/endpoint#errors"},{"kind":"code","literal":"404","chunkId":"api/endpoint#errors"},{"kind":"code","literal":"{ \"error\": \"…\" }","chunkId":"api/endpoint#errors"},{"kind":"code","literal":"500","chunkId":"api/endpoint#errors"},{"kind":"code","literal":"event: error","chunkId":"api/endpoint#errors"},{"kind":"code","literal":"200","chunkId":"api/endpoint#errors"},{"kind":"code","literal":"error","chunkId":"api/endpoint#errors"},{"kind":"value","literal":"e.g","chunkId":"api/endpoint#errors"}]
sources: [{"chunkId":"api/endpoint#errors","url":"/docs/api/endpoint#errors","anchor":"errors"}]
---

Error contract: 400 for invalid JSON bodies, 404 for missing digest reads, 500 when the chunk index fails to build, and — because the agentic stream is already 200 — mid-stream failures arrive as a final SSE error event rather than a status code.
