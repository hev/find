---
id: "limits#secrets-live-server-side"
title: "Limits"
heading: "Secrets live server-side"
group: "Overview"
order: 85
url: "/docs/limits#secrets-live-server-side"
anchor: "secrets-live-server-side"
terms: ["secrets","live","server","side","agentic","path","needs","configured","provider","environment","running","endpoint","never","exposed","browser","without","serves","keyword","results","search","degrades","doesn","break","anthropic","openai","openrouter","anthropicapikey","default","openaiapikey","openrouterapikey","option","runs","present","runtime"]
hash: "2adf59c2589370b5a968f7e95da1bd1c86a15fdc4f3dce2c0f994addb33152bc"
mode: "agent-primary"
facts: [{"kind":"code","literal":"ANTHROPIC_API_KEY","chunkId":"limits#secrets-live-server-side"},{"kind":"code","literal":"OPENAI_API_KEY","chunkId":"limits#secrets-live-server-side"},{"kind":"code","literal":"OPENROUTER_API_KEY","chunkId":"limits#secrets-live-server-side"},{"kind":"code","literal":"provider","chunkId":"limits#secrets-live-server-side"},{"kind":"code","literal":"/api/ask","chunkId":"limits#secrets-live-server-side"}]
sources: [{"chunkId":"limits#secrets-live-server-side","url":"/docs/limits#secrets-live-server-side","anchor":"secrets-live-server-side"}]
---

The agentic path needs the configured provider's key in the server environment running the endpoint; it's never exposed to the browser, and without it the endpoint serves keyword results — search degrades, it doesn't break.
