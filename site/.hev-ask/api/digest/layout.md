---
id: "api/digest#layout"
title: "Digest format"
heading: "Layout"
group: "API"
order: 22
url: "/docs/api/digest#layout"
anchor: "layout"
terms: ["layout","tree","meta","file","glossary","directory","term","markdown","heading","level","section","mirroring","paths","underscore","prefixed","names","mark","entries","sort","first","never","collide","real","slug","entire","artifact","committed","json","overview","context","suggestions","version","contenthash","digest","aliases","definition","quick","start","limits","chunk"]
hash: "6ebf2bffe75c0ce6e0e4ebce97214673a69cdc69161cbfe9d7e1a584adb512bc"
mode: "source-primary"
facts: [{"kind":"code","literal":".hev-ask/\n  _meta.md                     overview · context · suggestions · version · contentHash\n  _glossary/\n    digest.md                  one file per term: aliases + definition\n  overview/\n    quick-start.md             one file per section, mirroring your doc paths\n    limits.md\n  api/\n    cli.md","chunkId":"api/digest#layout"},{"kind":"code","literal":"_meta","chunkId":"api/digest#layout"},{"kind":"code","literal":"_glossary","chunkId":"api/digest#layout"}]
sources: [{"chunkId":"api/digest#layout","url":"/docs/api/digest#layout","anchor":"layout"}]
---

The tree layout: a meta file, a glossary directory with one file per term, and one markdown file per heading-level section mirroring the doc paths. Underscore-prefixed names mark non-section entries so they sort first and never collide with a real slug; the entire artifact is markdown with no committed JSON.
