---
id: "api/search-overlay#bundling-the-static-assets"
title: "SearchOverlay component"
heading: "Bundling the static assets"
group: "API"
order: 44
url: "/docs/api/search-overlay#bundling-the-static-assets"
anchor: "bundling-the-static-assets"
terms: ["bundling","static","assets","bundle","command","emits","browser","payload","keyword","index","glossary","suggestions","title","tree","directory","site","serves","output","generated","every","build","gitignored","committed","digest","stays","reviewable","source","truth","regenerating","prevents","drift","ships","like","step","renders","html","served","gitignore","keep","means"]
hash: "77f8c50f2486577e256ed8eda9ca5648330bd15f01f56ec275d154b6dfa0019d"
mode: "source-primary"
facts: [{"kind":"code","literal":"ask digest bundle","chunkId":"api/search-overlay#bundling-the-static-assets"},{"kind":"code","literal":".hev-ask/","chunkId":"api/search-overlay#bundling-the-static-assets"}]
sources: [{"chunkId":"api/search-overlay#bundling-the-static-assets","url":"/docs/api/search-overlay#bundling-the-static-assets","anchor":"bundling-the-static-assets"}]
---

The bundle command emits the browser payload — keyword index, glossary, suggestions, and title-tree — into a directory the site serves. The output is generated every build and gitignored, not committed; the committed digest tree stays the reviewable source of truth, and regenerating per build prevents drift from what ships.
