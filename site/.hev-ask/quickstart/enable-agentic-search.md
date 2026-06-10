---
id: "quickstart#enable-agentic-search"
title: "Quick start"
heading: "Enable agentic search"
group: "Overview"
order: 95
url: "/docs/quickstart#enable-agentic-search"
anchor: "enable-agentic-search"
terms: ["enable","agentic","search","provider","server","environment","route","runs","enter","loop","queries","grounded","answer","inline","deep","links","default","providers","also","need","option","integration","anthropic","needs","only","nothing","else","configure","export","openai","hevask","options","openrouter","host","secrets","local","present","pressing","overlay","self"]
hash: "ef1e17ef641cdc4792581c2c5f7d313aa573f6ccc6cb923f2288488784deac0e"
mode: "agent-primary"
facts: [{"kind":"code","literal":"# the default provider — nothing else to configure\nexport ANTHROPIC_API_KEY=sk-ant-...","chunkId":"quickstart#enable-agentic-search"},{"kind":"code","literal":"# with provider: \"openai\" in the hevAsk() options\nexport OPENAI_API_KEY=sk-...","chunkId":"quickstart#enable-agentic-search"},{"kind":"code","literal":"# with provider: \"openrouter\" in the hevAsk() options\nexport OPENROUTER_API_KEY=sk-or-...","chunkId":"quickstart#enable-agentic-search"},{"kind":"code","literal":"/api/ask","chunkId":"quickstart#enable-agentic-search"},{"kind":"code","literal":".env","chunkId":"quickstart#enable-agentic-search"},{"kind":"code","literal":"provider","chunkId":"quickstart#enable-agentic-search"}]
sources: [{"chunkId":"quickstart#enable-agentic-search","url":"/docs/quickstart#enable-agentic-search","anchor":"enable-agentic-search"}]
---

Set the provider's API key in the server environment where the search route runs; with a key, Enter runs the agentic loop with sub-queries, a grounded answer, and inline deep links. Non-default providers also need the provider option set in the integration; the Anthropic default needs only the key.
