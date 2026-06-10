---
id: "api/cli#flags"
title: "CLI"
heading: "Flags"
group: "API"
order: 4
url: "/docs/api/cli#flags"
anchor: "flags"
terms: ["flags","reference","table","global","covering","digest","directory","remote","endpoint","json","output","result","caps","collection","path","options","producer","commands","chunking","depth","model","provider","selection","sharded","mode","directories","sizing","verify","build","command","skip","strict","come","before","grep","openapi","https","hevask","docs","guides"]
hash: "fbe4499ab9007659db664eec6e7693dc252eab668c4d136ca4287dd223be1d52"
mode: "source-primary"
facts: [{"kind":"code","literal":"ask --digest-dir .hev-ask --json grep \"openapi\"\nask --endpoint https://hevask.com/api/ask cat api/endpoint\nask digest build --collection docs --collection guides --chunk-heading-depth 2\nask digest verify --skip-build","chunkId":"api/cli#flags"},{"kind":"code","literal":"--digest-dir \u003cdir\u003e","chunkId":"api/cli#flags"},{"kind":"code","literal":".hev-ask","chunkId":"api/cli#flags"},{"kind":"code","literal":"--endpoint \u003curl\u003e","chunkId":"api/cli#flags"},{"kind":"code","literal":"/api/ask","chunkId":"api/cli#flags"},{"kind":"code","literal":"answer","chunkId":"api/cli#flags"},{"kind":"code","literal":"--json","chunkId":"api/cli#flags"},{"kind":"code","literal":"--max-results \u003cn\u003e","chunkId":"api/cli#flags"},{"kind":"code","literal":"grep","chunkId":"api/cli#flags"},{"kind":"code","literal":"--collection \u003cname\u003e","chunkId":"api/cli#flags"},{"kind":"code","literal":"docs","chunkId":"api/cli#flags"},{"kind":"code","literal":"--base-path \u003cpath\u003e","chunkId":"api/cli#flags"},{"kind":"code","literal":"/docs/","chunkId":"api/cli#flags"},{"kind":"code","literal":"--content-glob \u003cglob\u003e","chunkId":"api/cli#flags"},{"kind":"code","literal":"--chunk-heading-depth \u003cn\u003e","chunkId":"api/cli#flags"},{"kind":"code","literal":"--digest-model \u003cmodel\u003e","chunkId":"api/cli#flags"},{"kind":"code","literal":"ask digest build","chunkId":"api/cli#flags"},{"kind":"code","literal":"claude-opus-4-8","chunkId":"api/cli#flags"},{"kind":"code","literal":"--provider \u003cname\u003e","chunkId":"api/cli#flags"},{"kind":"code","literal":"anthropic","chunkId":"api/cli#flags"},{"kind":"code","literal":"openai","chunkId":"api/cli#flags"},{"kind":"code","literal":"openrouter","chunkId":"api/cli#flags"},{"kind":"code","literal":"ANTHROPIC_API_KEY","chunkId":"api/cli#flags"},{"kind":"code","literal":"OPENAI_API_KEY","chunkId":"api/cli#flags"}]
sources: [{"chunkId":"api/cli#flags","url":"/docs/api/cli#flags","anchor":"flags"}]
---

Reference table of global CLI flags covering the digest directory, remote endpoint, JSON output, result caps, collection and path options for producer commands, chunking depth, model and provider selection, sharded-mode directories and sizing, and verify's build-command, skip-build, and strict options. Global flags come before the command.
