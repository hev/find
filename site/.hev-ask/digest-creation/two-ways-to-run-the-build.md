---
id: "digest-creation#two-ways-to-run-the-build"
title: "Digest creation"
heading: "Two ways to run the build"
group: "Overview"
order: 73
url: "/docs/digest-creation#two-ways-to-run-the-build"
anchor: "two-ways-to-run-the-build"
terms: ["ways","build","paths","recommended","bundled","claude","code","skill","needs","shards","corpus","size","never","hits","context","limit","unattended","call","default","configured","provider","both","write","same","tree","under","hash","gate","digest","runs","emits","sections","distil","writes","glossary","summaries","suggestions","assemble","export","anthropic"]
hash: "cc8ff5c21b0b7eeda4b14b44b4f1df1a979bf029b005e2bf8c24d334fe803413"
mode: "agent-primary"
facts: [{"kind":"code","literal":"You: build the hev ask digest\n\nClaude runs:\n  ask digest corpus       # emits the sections to distil\n  …writes context/glossary/summaries/suggestions…\n  ask digest assemble     # writes the .hev-ask/ tree","chunkId":"digest-creation#two-ways-to-run-the-build"},{"kind":"code","literal":"export ANTHROPIC_API_KEY=sk-ant-...\npnpm exec ask digest build","chunkId":"digest-creation#two-ways-to-run-the-build"},{"kind":"code","literal":"export OPENAI_API_KEY=sk-...\npnpm exec ask digest build --provider openai","chunkId":"digest-creation#two-ways-to-run-the-build"},{"kind":"code","literal":"export OPENROUTER_API_KEY=sk-or-...\npnpm exec ask digest build --provider openrouter","chunkId":"digest-creation#two-ways-to-run-the-build"},{"kind":"code","literal":"build-digest","chunkId":"digest-creation#two-ways-to-run-the-build"},{"kind":"code","literal":"ANTHROPIC_API_KEY","chunkId":"digest-creation#two-ways-to-run-the-build"},{"kind":"code","literal":"--provider","chunkId":"digest-creation#two-ways-to-run-the-build"},{"kind":"value","literal":"4.8","chunkId":"digest-creation#two-ways-to-run-the-build"}]
sources: [{"chunkId":"digest-creation#two-ways-to-run-the-build","url":"/docs/digest-creation#two-ways-to-run-the-build","anchor":"two-ways-to-run-the-build"}]
---

Two build paths: the recommended bundled Claude Code skill, which needs no API key and shards the corpus so size never hits a context limit, and the CLI build for CI or non-Claude-Code use, one unattended API call on the default or any configured provider. Both write the same tree under the same hash gate.
