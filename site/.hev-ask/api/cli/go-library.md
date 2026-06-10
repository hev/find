---
id: "api/cli#go-library"
title: "CLI"
heading: "Go library"
group: "API"
order: 5
url: "/docs/api/cli#go-library"
anchor: "go-library"
terms: ["library","reusable","offers","pure","helpers","loading","digest","tree","embedded","filesystem","listing","summaries","getting","sections","searching","endpoint","client","serving","dependency","free","command","group","mount","inside","newcommandgroup","commandoptions","digestdir","string","overview","quick","start","stdin","stdout","stderr","loaddigest","embed","listsectionsummaries","getsection","searchdigest","newendpointclient"]
hash: "fdda297bbdabdbd250da161cec7574e09209c99f50b254923354681e1bef245c"
mode: "source-primary"
facts: [{"kind":"code","literal":"group := ask.NewCommandGroup(ask.CommandOptions{\n\tDigestDir: \".hev-ask\",\n})\nerr := group.Run(ctx, []string{\"cat\", \"overview/quick-start\"}, os.Stdin, os.Stdout, os.Stderr)","chunkId":"api/cli#go-library"},{"kind":"code","literal":"pkg/ask","chunkId":"api/cli#go-library"},{"kind":"code","literal":"LoadDigest","chunkId":"api/cli#go-library"},{"kind":"code","literal":"embed.FS","chunkId":"api/cli#go-library"},{"kind":"code","literal":"ListSectionSummaries","chunkId":"api/cli#go-library"},{"kind":"code","literal":"GetSection","chunkId":"api/cli#go-library"},{"kind":"code","literal":"SearchDigest","chunkId":"api/cli#go-library"},{"kind":"code","literal":"NewEndpointClient","chunkId":"api/cli#go-library"},{"kind":"code","literal":"ServeMCP","chunkId":"api/cli#go-library"}]
sources: [{"chunkId":"api/cli#go-library","url":"/docs/api/cli#go-library","anchor":"go-library"}]
---

The reusable Go API in pkg/ask offers pure helpers (loading the digest from a tree or embedded filesystem, listing summaries, getting sections, searching, an endpoint client, and serving MCP) or a dependency-free command group you can mount inside your own CLI.
