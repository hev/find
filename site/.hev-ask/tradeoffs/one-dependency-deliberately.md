---
id: "tradeoffs#one-dependency-deliberately"
title: "Tradeoffs"
heading: "One dependency, deliberately"
group: "Overview"
order: 105
url: "/docs/tradeoffs#one-dependency-deliberately"
anchor: "one-dependency-deliberately"
terms: ["dependency","deliberately","package","near","zero","deliberate","exception","github","slugger","small","pure","edge","safe","library","guarantees","byte","identical","heading","anchors","astro","rather","risking","hand","rolled","slugs","page","adapters","extend","guarantee","their","slug","rules","aims","close","generating","risks","drifting","renderer","shipping","link"]
hash: "ab20e6d42c28963543737ab48f6363737ae3acca033cbf40114668f79b31f2c6"
mode: "agent-primary"
facts: [{"kind":"code","literal":"github-slugger","chunkId":"tradeoffs#one-dependency-deliberately"},{"kind":"value","literal":"github.com","chunkId":"tradeoffs#one-dependency-deliberately"}]
sources: [{"chunkId":"tradeoffs#one-dependency-deliberately","url":"/docs/tradeoffs#one-dependency-deliberately","anchor":"one-dependency-deliberately"}]
---

The package is near zero-dependency with one deliberate exception: github-slugger, a small pure-JS, edge-safe library that guarantees byte-identical heading anchors with Astro and GitHub rather than risking hand-rolled slugs that 404 to the top of the page; adapters extend the guarantee to their own slug rules.
