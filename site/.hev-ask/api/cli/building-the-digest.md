---
id: "api/cli#building-the-digest"
title: "CLI"
heading: "Building the digest"
group: "API"
order: 1
url: "/docs/api/cli#building-the-digest"
anchor: "building-the-digest"
terms: ["building","digest","lists","producer","commands","site","root","explains","only","build","command","calls","model","needs","selectable","provider","builds","incremental","hash","gated","changed","sections","distilled","clean","tree","makes","zero","shot","fails","past","600kb","section","text","pointing","sharded","flow","migrate","converts","legacy","json"]
hash: "c8c9b3c2808376bf87bc7128a3a9a84bdde6aa70ac2011e1ccb1debae2976f33"
mode: "source-primary"
facts: [{"kind":"code","literal":"export ANTHROPIC_API_KEY=sk-ant-...\nask digest build                    # claude-opus-4-8 by default","chunkId":"api/cli#building-the-digest"},{"kind":"code","literal":"export OPENAI_API_KEY=sk-...\nask digest build --provider openai  # gpt-5.1 by default","chunkId":"api/cli#building-the-digest"},{"kind":"code","literal":"export OPENROUTER_API_KEY=sk-or-...\nask digest build --provider openrouter   # anthropic/claude-opus-4.8 by default","chunkId":"api/cli#building-the-digest"},{"kind":"code","literal":"ask digest build","chunkId":"api/cli#building-the-digest"},{"kind":"code","literal":"--provider","chunkId":"api/cli#building-the-digest"},{"kind":"code","literal":"ask digest corpus","chunkId":"api/cli#building-the-digest"},{"kind":"code","literal":"ask digest assemble","chunkId":"api/cli#building-the-digest"},{"kind":"code","literal":".hev-ask/","chunkId":"api/cli#building-the-digest"},{"kind":"code","literal":"context","chunkId":"api/cli#building-the-digest"},{"kind":"code","literal":"summaries","chunkId":"api/cli#building-the-digest"},{"kind":"code","literal":"suggestions","chunkId":"api/cli#building-the-digest"},{"kind":"code","literal":".hev-ask/digest.json","chunkId":"api/cli#building-the-digest"},{"kind":"code","literal":"ask digest migrate","chunkId":"api/cli#building-the-digest"},{"kind":"value","literal":"digest.json","chunkId":"api/cli#building-the-digest"}]
sources: [{"chunkId":"api/cli#building-the-digest","url":"/docs/api/cli#building-the-digest","anchor":"building-the-digest"}]
---

Lists the producer commands run from the site root and explains that only the build command calls a model (so only it needs a key, selectable per provider). Builds are incremental and hash-gated — only changed sections are re-distilled, a clean tree makes zero model calls — and the one-shot build fails past 600KB of new section text, pointing to the sharded flow. A migrate command converts a legacy digest.json to the tree with no model call.
