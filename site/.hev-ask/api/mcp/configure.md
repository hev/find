---
id: "api/mcp#configure"
title: "MCP server"
heading: "Configure"
group: "API"
order: 37
url: "/docs/api/mcp#configure"
anchor: "configure"
terms: ["configure","configurations","point","server","checked","repo","local","digest","directory","keyless","deployed","site","endpoint","including","other","running","pull","docs","agent","workspace","anywhere","mcpservers","command","args","hevask","https","reads","tree","runs","pulled"]
hash: "bd48710aaa8e6b45422ed8cee00e44b2004fdbd68d1178fac60bae41e706b728"
mode: "source-primary"
facts: [{"kind":"code","literal":"{\n  \"mcpServers\": {\n    \"docs\": {\n      \"command\": \"ask\",\n      \"args\": [\"--digest-dir\", \".hev-ask\", \"mcp\"]\n    }\n  }\n}","chunkId":"api/mcp#configure"},{"kind":"code","literal":"{\n  \"mcpServers\": {\n    \"hevask\": {\n      \"command\": \"ask\",\n      \"args\": [\"--endpoint\", \"https://hevask.com/api/ask\", \"mcp\"]\n    }\n  }\n}","chunkId":"api/mcp#configure"}]
sources: [{"chunkId":"api/mcp#configure","url":"/docs/api/mcp#configure","anchor":"configure"}]
---

Two configurations: point the server at a checked-out repo's local digest directory (keyless), or at a deployed site's endpoint — including any other site running hev ask — to pull its docs into the agent's workspace from anywhere.
