---
id: "quickstart#5-build-the-digest"
title: "Quick start"
heading: "5. Build the digest"
group: "Overview"
order: 94
url: "/docs/quickstart#5-build-the-digest"
anchor: "5-build-the-digest"
terms: ["build","digest","committed","tree","feeds","loop","domain","context","ranks","keyword","results","supplies","glossary","holds","suggested","questions","recommended","path","bundled","claude","code","skill","token","spend","alternative","provider","selection","both","incremental","hash","gated","verify","commit","afterward","integration","rebuilds","automatically","during","site","present"]
hash: "c3e971ffc29cc5333a5448cb5e2846615f72af766d664a071dd8b904dd6b09d4"
mode: "agent-primary"
facts: [{"kind":"code","literal":"You: build the hev ask digest\n\nClaude runs:\n  ask digest corpus       # emits the sections to distil\n  …writes context/glossary/summaries/suggestions…\n  ask digest assemble     # writes the .hev-ask/ tree","chunkId":"quickstart#5-build-the-digest"},{"kind":"code","literal":"export ANTHROPIC_API_KEY=sk-ant-...\npnpm exec ask digest build      # writes the .hev-ask/ tree","chunkId":"quickstart#5-build-the-digest"},{"kind":"code","literal":"export OPENAI_API_KEY=sk-...\npnpm exec ask digest build --provider openai","chunkId":"quickstart#5-build-the-digest"},{"kind":"code","literal":"export OPENROUTER_API_KEY=sk-or-...\npnpm exec ask digest build --provider openrouter","chunkId":"quickstart#5-build-the-digest"},{"kind":"code","literal":"pnpm exec ask digest verify     # builds the site, checks every anchor resolves\ngit add .hev-ask","chunkId":"quickstart#5-build-the-digest"},{"kind":"code","literal":"k8s","chunkId":"quickstart#5-build-the-digest"},{"kind":"code","literal":"kubernetes","chunkId":"quickstart#5-build-the-digest"},{"kind":"code","literal":"--provider","chunkId":"quickstart#5-build-the-digest"},{"kind":"code","literal":"astro build","chunkId":"quickstart#5-build-the-digest"},{"kind":"value","literal":"claude.com","chunkId":"quickstart#5-build-the-digest"}]
sources: [{"chunkId":"quickstart#5-build-the-digest","url":"/docs/quickstart#5-build-the-digest","anchor":"5-build-the-digest"}]
---

Build the committed digest tree — it feeds the loop's domain context, ranks keyword results, supplies the glossary, and holds suggested questions. The recommended path is the bundled Claude Code skill (no API key, no token spend); the CLI build is the CI alternative with provider selection. Both are incremental and hash-gated; verify and commit afterward, and the integration rebuilds automatically during the site build when a key is present.
