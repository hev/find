---
id: "concepts#keyword-search-and-the-glossary"
title: "Concepts"
heading: "Keyword search and the glossary"
group: "Overview"
order: 64
url: "/docs/concepts#keyword-search-and-the-glossary"
anchor: "keyword-search-and-the-glossary"
terms: ["keyword","search","glossary","instant","path","dependency","free","prefilter","expand","query","term","aliases","score","token","overlap","widened","digest","summaries","terms","facts","central","sections","outrank","incidental","mentions","results","document","excerpt","around","first","match","embeddings","tree","degrades","plain","always","works","grep","kubernetes","summary"]
hash: "6496e6a2896ae22bcdf61b3dbba97df885d89427d2f4b266e7553f09e094cb91"
mode: "agent-primary"
facts: [{"kind":"code","literal":"grep","chunkId":"concepts#keyword-search-and-the-glossary"},{"kind":"code","literal":"k8s","chunkId":"concepts#keyword-search-and-the-glossary"},{"kind":"code","literal":"kubernetes","chunkId":"concepts#keyword-search-and-the-glossary"},{"kind":"code","literal":"summary","chunkId":"concepts#keyword-search-and-the-glossary"},{"kind":"code","literal":"terms","chunkId":"concepts#keyword-search-and-the-glossary"},{"kind":"code","literal":"facts","chunkId":"concepts#keyword-search-and-the-glossary"}]
sources: [{"chunkId":"concepts#keyword-search-and-the-glossary","url":"/docs/concepts#keyword-search-and-the-glossary","anchor":"keyword-search-and-the-glossary"}]
---

The instant path is a dependency-free prefilter: expand each query term with glossary aliases, score by token overlap widened by the digest's summaries, terms, and facts (so central sections outrank incidental mentions), cap results per document, and excerpt around the first match. No API key, no embeddings — and with no tree it degrades to plain token overlap, so keyword search always works.
