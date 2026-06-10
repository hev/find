---
id: "limits#frontmatter-parsing-is-a-flat-yaml-subset"
title: "Limits"
heading: "Frontmatter parsing is a flat-YAML subset"
group: "Overview"
order: 83
url: "/docs/limits#frontmatter-parsing-is-a-flat-yaml-subset"
anchor: "frontmatter-parsing-is-a-flat-yaml-subset"
terms: ["frontmatter","parsing","flat","yaml","subset","offline","build","parses","small","splitter","handling","string","number","fields","nested","structures","aren","supported","only","affects","file","reading","astro","runtime","index","uses","collection","honors","real","schema","getcollection","full","parser","handles","common","docs","time","files","disk"]
hash: "da3ebf7a72c862c9bb94804726792203ebd2dad95887c4c094bf492223e719b8"
mode: "agent-primary"
facts: [{"kind":"code","literal":"getCollection","chunkId":"limits#frontmatter-parsing-is-a-flat-yaml-subset"}]
sources: [{"chunkId":"limits#frontmatter-parsing-is-a-flat-yaml-subset","url":"/docs/limits#frontmatter-parsing-is-a-flat-yaml-subset","anchor":"frontmatter-parsing-is-a-flat-yaml-subset"}]
---

The offline build parses frontmatter with a small flat-YAML splitter handling string and number fields; nested structures aren't supported. This only affects the offline file-reading build — the Astro runtime index uses the collection API, which honors the real schema.
