---
id: "api/cli#distribution"
title: "CLI"
heading: "Distribution"
group: "API"
order: 3
url: "/docs/api/cli#distribution"
anchor: "distribution"
terms: ["distribution","package","exposes","single","whose","launcher","resolves","override","first","platform","specific","optional","binary","checked","source","latter","only","monorepo","development","hevaskbinary","installed","fallback","published","installs","packaged","path"]
hash: "6ca69ef59f845bf9734dc9ec208f3fa63fdd9272703d454891bdbebb56fcda55"
mode: "source-primary"
facts: [{"kind":"code","literal":"ask","chunkId":"api/cli#distribution"},{"kind":"code","literal":"HEV_ASK_BINARY","chunkId":"api/cli#distribution"}]
sources: [{"chunkId":"api/cli#distribution","url":"/docs/api/cli#distribution","anchor":"distribution"}]
---

The npm package exposes a single bin whose launcher resolves an env-var override first, then a platform-specific optional binary package, then the checked-out Go source (the latter only for monorepo development).
