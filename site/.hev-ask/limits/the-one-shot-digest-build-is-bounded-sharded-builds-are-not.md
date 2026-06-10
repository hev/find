---
id: "limits#the-one-shot-digest-build-is-bounded-sharded-builds-are-not"
title: "Limits"
heading: "The one-shot digest build is bounded; sharded builds are not"
group: "Overview"
order: 88
url: "/docs/limits#the-one-shot-digest-build-is-bounded-sharded-builds-are-not"
anchor: "the-one-shot-digest-build-is-bounded-sharded-builds-are-not"
terms: ["shot","digest","build","bounded","sharded","builds","sends","full","cleaned","corpus","model","call","fails","loudly","past","600kb","section","text","beyond","splits","prefix","stable","shards","distilled","fresh","contexts","merged","deterministically","scaling","corpora","tens","thousands","sections","remaining","ceiling","runtime","prompt","answer","loop","inlines"]
hash: "b92a502b0c0bf50078803a9d6b07d38be0501c79206b0246bd30626eb1f8f08f"
mode: "agent-primary"
facts: [{"kind":"code","literal":"ask digest build","chunkId":"limits#the-one-shot-digest-build-is-bounded-sharded-builds-are-not"}]
sources: [{"chunkId":"limits#the-one-shot-digest-build-is-bounded-sharded-builds-are-not","url":"/docs/limits#the-one-shot-digest-build-is-bounded-sharded-builds-are-not","anchor":"the-one-shot-digest-build-is-bounded-sharded-builds-are-not"}]
---

The one-shot build sends the full cleaned corpus in one model call and fails loudly past 600KB of section text; beyond that, the sharded build splits the corpus into prefix-stable shards distilled in fresh contexts and merged deterministically, scaling to corpora of tens of thousands of sections. The remaining ceiling is the runtime prompt: the answer loop inlines summaries, so very large trees don't yet fit it, though an agent reading over MCP pages through files with no such limit.
