---
id: "concepts#the-agentic-search-loop"
title: "Concepts"
heading: "The agentic search loop"
group: "Overview"
order: 66
url: "/docs/concepts#the-agentic-search-loop"
anchor: "the-agentic-search-loop"
terms: ["agentic","search","loop","runs","phases","gather","model","sees","full","title","tree","opens","sections","single","open","section","tool","bounded","number","rounds","answer","accumulated","sources","overlay","link","validation","called","once","more","tools","only","write","prose","constrained","retrieved","links","provided","urls","cannot","ground"]
hash: "2f6dfa7319e162069240585c70a19b0d2727aa413c0bddd5dd0644f360619892"
mode: "agent-primary"
facts: [{"kind":"code","literal":"open_section({ id })","chunkId":"concepts#the-agentic-search-loop"},{"kind":"code","literal":"facts","chunkId":"concepts#the-agentic-search-loop"},{"kind":"code","literal":"maxIterations","chunkId":"concepts#the-agentic-search-loop"},{"kind":"code","literal":"url","chunkId":"concepts#the-agentic-search-loop"}]
sources: [{"chunkId":"concepts#the-agentic-search-loop","url":"/docs/concepts#the-agentic-search-loop","anchor":"the-agentic-search-loop"}]
---

The loop runs in two phases: gather, where the model sees the full title-tree and opens sections with a single open-section tool for up to a bounded number of rounds; and answer, where the accumulated sources go to the overlay for link validation and the model is called once more with no tools so it can only write prose. The answer is constrained to retrieved sections — it links only to provided URLs and cannot ground in what retrieval never found.
