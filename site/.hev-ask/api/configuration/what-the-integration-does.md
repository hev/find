---
id: "api/configuration#what-the-integration-does"
title: "Configuration"
heading: "What the integration does"
group: "API"
order: 15
url: "/docs/api/configuration#what-the-integration-does"
anchor: "what-the-integration-does"
terms: ["integration","does","astro","config","setup","injects","demand","endpoint","route","registers","digest","virtual","modules","watches","directory","reloads","warns","empty","collections","build","start","runs","hash","gated","provider","present","otherwise","proceeds","committed","artifact","never","fails","lack","hevmind","prerender","false","digestdir","anthropic","starts","pointing"]
hash: "0b9a79f3448bfbbfaff7b1b2d3b80844d670db91fb5228cd58d14f8a8f57220a"
mode: "source-primary"
facts: [{"kind":"code","literal":"astro:config:setup","chunkId":"api/configuration#what-the-integration-does"},{"kind":"code","literal":"endpoint","chunkId":"api/configuration#what-the-integration-does"},{"kind":"code","literal":"@hevmind/ask/endpoint","chunkId":"api/configuration#what-the-integration-does"},{"kind":"code","literal":"prerender: false","chunkId":"api/configuration#what-the-integration-does"},{"kind":"code","literal":"virtual:hev-ask/config","chunkId":"api/configuration#what-the-integration-does"},{"kind":"code","literal":"virtual:hev-ask/digest","chunkId":"api/configuration#what-the-integration-does"},{"kind":"code","literal":"digestDir","chunkId":"api/configuration#what-the-integration-does"},{"kind":"code","literal":"collections","chunkId":"api/configuration#what-the-integration-does"},{"kind":"code","literal":"astro:build:start","chunkId":"api/configuration#what-the-integration-does"},{"kind":"code","literal":"ANTHROPIC_API_KEY","chunkId":"api/configuration#what-the-integration-does"}]
sources: [{"chunkId":"api/configuration#what-the-integration-does","url":"/docs/api/configuration#what-the-integration-does","anchor":"what-the-integration-does"}]
---

At Astro config setup the integration injects the on-demand endpoint route, registers the config and digest virtual modules, watches the digest directory for dev reloads, and warns on empty collections. At build start it runs the hash-gated digest build when the provider key is present, otherwise warns and proceeds with the committed artifact — the build never fails for lack of a key.
