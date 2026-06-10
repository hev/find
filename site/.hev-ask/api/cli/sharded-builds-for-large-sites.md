---
id: "api/cli#sharded-builds-for-large-sites"
title: "CLI"
heading: "Sharded builds for large sites"
group: "API"
order: 8
url: "/docs/api/cli#sharded-builds-for-large-sites"
anchor: "sharded-builds-for-large-sites"
terms: ["sharded","builds","large","sites","flow","removes","first","build","context","bound","corpus","splits","along","slug","prefix","boundaries","shard","distilled","fresh","assembly","merges","tree","sharding","stable","incremental","editing","pends","only","stale","distillations","detected","hash","skipped","warning","fall","back","plain","excerpts","until","verify"]
hash: "edb0ce1e92994c33baa1814a21cdfb79ae95bdf7c3ffc385218dcd0f79c2d35e"
mode: "source-primary"
facts: [{"kind":"code","literal":"ask digest corpus --shards-dir .hev-ask/shards   # input-\u003cid\u003e.json per shard + manifest.json\nask digest status --shards-dir .hev-ask/shards   # distilled / pending / stale, per shard\n# ...one distillation per shard writes distill-\u003cid\u003e.json; a final pass writes global.json...\nask digest assemble --input-dir .hev-ask/shards  # merge + write the .hev-ask/ tree","chunkId":"api/cli#sharded-builds-for-large-sites"},{"kind":"code","literal":"workers/...","chunkId":"api/cli#sharded-builds-for-large-sites"},{"kind":"code","literal":"pages/...","chunkId":"api/cli#sharded-builds-for-large-sites"},{"kind":"code","literal":"corpus","chunkId":"api/cli#sharded-builds-for-large-sites"},{"kind":"code","literal":"ask digest verify","chunkId":"api/cli#sharded-builds-for-large-sites"},{"kind":"code","literal":"--skip-build","chunkId":"api/cli#sharded-builds-for-large-sites"},{"kind":"code","literal":"_meta.md","chunkId":"api/cli#sharded-builds-for-large-sites"},{"kind":"code","literal":"--strict","chunkId":"api/cli#sharded-builds-for-large-sites"}]
sources: [{"chunkId":"api/cli#sharded-builds-for-large-sites","url":"/docs/api/cli#sharded-builds-for-large-sites","anchor":"sharded-builds-for-large-sites"}]
---

The sharded flow removes the first-build context bound: the corpus splits along slug-prefix boundaries, each shard is distilled in a fresh context, and assembly merges the tree. Sharding is stable and incremental — editing one doc re-pends only its shard, and stale distillations are detected by shard hash, skipped with a warning, and fall back to plain excerpts until re-distilled. Verify checks rendered anchors (always fatal on drift), coverage, literal fidelity, and tree integrity (warnings unless strict).
