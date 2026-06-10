---
id: "concepts#the-system-prompt-is-cached"
title: "Concepts"
heading: "The system prompt is cached"
group: "Overview"
order: 68
url: "/docs/concepts#the-system-prompt-is-cached"
anchor: "the-system-prompt-is-cached"
terms: ["system","prompt","cached","title","tree","summaries","enter","cache","control","marker","gather","rounds","toolless","answer","turn","reuse","final","call","anyway","reader","server","side","loop","consumer","coding","agent","distinct","readers","climbing","same","four","rung","ladder","memory","other","files","disk","section","injected","cachecontrol"]
hash: "740d6a77b01eeb8a97450a731c865c453c8e7aac42a1971856ecacdf05622c39"
mode: "agent-primary"
facts: [{"kind":"code","literal":"cache_control","chunkId":"concepts#the-system-prompt-is-cached"},{"kind":"value","literal":"4.5","chunkId":"concepts#the-system-prompt-is-cached"}]
sources: [{"chunkId":"concepts#the-system-prompt-is-cached","url":"/docs/concepts#the-system-prompt-is-cached","anchor":"the-system-prompt-is-cached"}]
---

The title-tree and summaries enter the system prompt with a cache-control marker, so the gather rounds hit the prompt cache; the toolless answer turn can't reuse it but is the final call anyway. The reader's server-side loop and a consumer's coding agent are distinct readers climbing the same four-rung ladder — one over the in-memory tree, the other over files on its own disk.
