---
id: "api/mcp#co-location"
title: "MCP server"
heading: "Co-location"
group: "API"
order: 36
url: "/docs/api/mcp#co-location"
anchor: "co-location"
terms: ["location","hydrate","disk","assumes","server","agent","file","tools","share","host","true","stdio","transport","only","exposes","remote","read","cache","would","need","separate","resource","fallback","since","local","path","useless","stdin","stdout","default","intentionally","cannot","tool","because","returning","useful"]
hash: "0dd5d436dbfe12945ae2a67bf0100156e9645f9c1e9a8afe293b1b83a7348757"
mode: "source-primary"
facts: [{"kind":"code","literal":"ask mcp","chunkId":"api/mcp#co-location"}]
sources: [{"chunkId":"api/mcp#co-location","url":"/docs/api/mcp#co-location","anchor":"co-location"}]
---

Hydrate-to-disk assumes the MCP server and the agent's file tools share a host, which is true for the stdio transport — the only one this server exposes. A remote transport where the agent can't read the server's cache would need a separate resource fallback, since a local path would be useless.
