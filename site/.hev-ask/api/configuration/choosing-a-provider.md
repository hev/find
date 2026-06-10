---
id: "api/configuration#choosing-a-provider"
title: "Configuration"
heading: "Choosing a provider"
group: "API"
order: 11
url: "/docs/api/configuration#choosing-a-provider"
anchor: "choosing-a-provider"
terms: ["choosing","provider","option","selects","serves","both","runtime","loop","offline","digest","build","behavior","format","endpoint","contract","identical","only","model","defaults","change","openrouter","reaches","routes","base","override","makes","openai","compatible","work","models","must","support","tool","calling","builder","also","needs","forced","choice","astro"]
hash: "64020ee9bbb713bf179bf7c6d3f2673b780e483e4c6b7f584c829f690db6acd3"
mode: "source-primary"
facts: [{"kind":"code","literal":"// astro.config.mjs — the default; reads ANTHROPIC_API_KEY\nhevAsk({\n  collections: [\"docs\"],\n  // model defaults to claude-haiku-4-5\n});","chunkId":"api/configuration#choosing-a-provider"},{"kind":"code","literal":"// astro.config.mjs — reads OPENAI_API_KEY\nhevAsk({\n  collections: [\"docs\"],\n  provider: \"openai\",\n  // model defaults to gpt-4.1-mini\n});","chunkId":"api/configuration#choosing-a-provider"},{"kind":"code","literal":"// astro.config.mjs — reads OPENROUTER_API_KEY\nhevAsk({\n  collections: [\"docs\"],\n  provider: \"openrouter\",\n  model: \"anthropic/claude-haiku-4.5\", // or any OpenRouter model slug\n});","chunkId":"api/configuration#choosing-a-provider"},{"kind":"code","literal":"hevAsk({\n  collections: [\"docs\"],\n  provider: \"openai\",\n  providerBaseUrl: \"https://my-gateway.example.com/v1\",\n  model: \"my-model\",\n});","chunkId":"api/configuration#choosing-a-provider"},{"kind":"code","literal":"provider","chunkId":"api/configuration#choosing-a-provider"},{"kind":"code","literal":"OPENROUTER_API_KEY","chunkId":"api/configuration#choosing-a-provider"},{"kind":"code","literal":"providerBaseUrl","chunkId":"api/configuration#choosing-a-provider"},{"kind":"code","literal":"provider: \"openai\"","chunkId":"api/configuration#choosing-a-provider"},{"kind":"code","literal":"endpoint","chunkId":"api/configuration#choosing-a-provider"},{"kind":"code","literal":"/api/ask","chunkId":"api/configuration#choosing-a-provider"},{"kind":"code","literal":"SearchOverlay","chunkId":"api/configuration#choosing-a-provider"}]
sources: [{"chunkId":"api/configuration#choosing-a-provider","url":"/docs/api/configuration#choosing-a-provider","anchor":"choosing-a-provider"}]
---

The provider option selects who serves both the runtime loop and the offline digest build — behavior, digest format, and endpoint contract are identical; only the model defaults and key env var change. OpenRouter reaches any model it routes with one key, and a base-URL override makes any OpenAI-compatible endpoint work. Loop models must support tool calling; the digest builder also needs forced tool choice.
