---
id: "api/search-overlay#props"
title: "SearchOverlay component"
heading: "Props"
group: "API"
order: 50
url: "/docs/api/search-overlay#props"
anchor: "props"
terms: ["props","component","takes","three","endpoint","posts","queries","must","match","integration","option","input","placeholder","text","debounce","delay","before","keyword","query","sent","searchoverlay","search","string","docs","number","prop","type","default","description","overlay","milliseconds","after","typing","stops"]
hash: "ae4f683359160725bca5d58e0e1aac3897a94d552fab66a948c2682add9e2524"
mode: "source-primary"
facts: [{"kind":"code","literal":"\u003cSearchOverlay\n  endpoint=\"/api/ask\"\n  placeholder=\"Search hev ask…\"\n  debounce={400}\n/\u003e","chunkId":"api/search-overlay#props"},{"kind":"code","literal":"endpoint","chunkId":"api/search-overlay#props"},{"kind":"code","literal":"string","chunkId":"api/search-overlay#props"},{"kind":"code","literal":"'/api/ask'","chunkId":"api/search-overlay#props"},{"kind":"code","literal":"placeholder","chunkId":"api/search-overlay#props"},{"kind":"code","literal":"'Search the docs…'","chunkId":"api/search-overlay#props"},{"kind":"code","literal":"debounce","chunkId":"api/search-overlay#props"},{"kind":"code","literal":"number","chunkId":"api/search-overlay#props"},{"kind":"code","literal":"500","chunkId":"api/search-overlay#props"}]
sources: [{"chunkId":"api/search-overlay#props","url":"/docs/api/search-overlay#props","anchor":"props"}]
---

The component takes three props: the endpoint it posts queries to (which must match the integration's endpoint option), the input placeholder text, and the debounce delay before a keyword query is sent.
