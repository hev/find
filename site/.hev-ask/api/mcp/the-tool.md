---
id: "api/mcp#the-tool"
title: "MCP server"
heading: "The tool"
group: "API"
order: 41
url: "/docs/api/mcp#the-tool"
anchor: "the-tool"
terms: ["tool","single","materializes","digest","tree","host","keyed","local","cache","path","returns","title","inline","plus","content","hash","section","count","date","flag","call","bootstraps","whole","disclosure","ladder","after","agent","uses","native","file","tools","force","argument","pulls","unconditionally","otherwise","remote","compared","download","skipped"]
hash: "54bc7be8d62d5112772761d161b203c851308fffd7751b1c920e8c99e1975b96"
mode: "source-primary"
facts: [{"kind":"code","literal":"tree ~/.cache/hev-ask/hevask.com        # already returned inline by fetch_docs\ncat  ~/.cache/hev-ask/hevask.com/overview/quick-start.md\ngrep -r \"prerender\" ~/.cache/hev-ask/hevask.com","chunkId":"api/mcp#the-tool"},{"kind":"code","literal":"fetch_docs","chunkId":"api/mcp#the-tool"},{"kind":"code","literal":"{ force?: boolean }","chunkId":"api/mcp#the-tool"},{"kind":"code","literal":"{ path, contentHash, sections, tree, upToDate }","chunkId":"api/mcp#the-tool"},{"kind":"code","literal":"~/.cache/hev-ask/hevask.com/","chunkId":"api/mcp#the-tool"},{"kind":"code","literal":"force: true","chunkId":"api/mcp#the-tool"},{"kind":"code","literal":"contentHash","chunkId":"api/mcp#the-tool"},{"kind":"code","literal":"upToDate: true","chunkId":"api/mcp#the-tool"},{"kind":"value","literal":"e.g","chunkId":"api/mcp#the-tool"}]
sources: [{"chunkId":"api/mcp#the-tool","url":"/docs/api/mcp#the-tool","anchor":"the-tool"}]
---

The single tool materializes the digest tree at a host-keyed local cache path and returns the title-tree inline plus path, content hash, section count, and an up-to-date flag — one call bootstraps the whole disclosure ladder, after which the agent uses native file tools. A force argument re-pulls unconditionally; otherwise the remote content hash is compared and the download skipped when unchanged. The bounded corpus compresses small enough to ship in one shot with no per-file delta protocol.
