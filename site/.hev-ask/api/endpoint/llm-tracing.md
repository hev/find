---
id: "api/endpoint#llm-tracing"
title: "Search endpoint"
heading: "LLM tracing"
group: "API"
order: 30
url: "/docs/api/endpoint#llm-tracing"
anchor: "llm-tracing"
terms: ["tracing","setting","posthog","server","environment","makes","every","agentic","answer","emit","generation","trace","model","tokens","latency","tool","calls","host","content","capture","level","configurable","without","path","never","depends","redacted","full","posthogkey","posthogapikey","same","emits","aigeneration","loop","posthoghost","overrides","cloud","ingestion","posthogcapturecontent","default"]
hash: "e583d09f55427f22b7d112b649fb4111c7081e86ca0197320fc01a19b6e0c354"
mode: "source-primary"
facts: [{"kind":"code","literal":"POSTHOG_KEY","chunkId":"api/endpoint#llm-tracing"},{"kind":"code","literal":"POSTHOG_API_KEY","chunkId":"api/endpoint#llm-tracing"},{"kind":"code","literal":"$ai_generation","chunkId":"api/endpoint#llm-tracing"},{"kind":"code","literal":"POSTHOG_HOST","chunkId":"api/endpoint#llm-tracing"},{"kind":"code","literal":"POSTHOG_CAPTURE_CONTENT","chunkId":"api/endpoint#llm-tracing"},{"kind":"code","literal":"off","chunkId":"api/endpoint#llm-tracing"},{"kind":"code","literal":"redacted","chunkId":"api/endpoint#llm-tracing"},{"kind":"code","literal":"full","chunkId":"api/endpoint#llm-tracing"}]
sources: [{"chunkId":"api/endpoint#llm-tracing","url":"/docs/api/endpoint#llm-tracing","anchor":"llm-tracing"}]
---

Setting a PostHog key in the server environment makes every agentic answer emit an AI-generation trace with model, tokens, latency, and tool calls; host and content-capture level are configurable, and without a key tracing is a no-op the answer path never depends on.
