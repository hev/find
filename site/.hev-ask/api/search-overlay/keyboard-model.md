---
id: "api/search-overlay#keyboard-model"
title: "SearchOverlay component"
heading: "Keyboard model"
group: "API"
order: 46
url: "/docs/api/search-overlay#keyboard-model"
anchor: "keyboard-model"
terms: ["keyboard","model","overlay","first","word","count","driven","runs","debounced","keyword","search","result","auto","active","second","switches","mode","enter","sends","question","agentic","loop","arrow","keys","move","selection","escape","closes","suggested","questions","appear","open","enabled","without","server","asking","returns","results","visible","warning"]
hash: "ee1d21380babc93166dcbdb53a1180c1fd71608113d3f633a28f81b7c40dd1b6"
mode: "source-primary"
facts: [{"kind":"code","literal":"Tab","chunkId":"api/search-overlay#keyboard-model"},{"kind":"code","literal":"ANTHROPIC_API_KEY","chunkId":"api/search-overlay#keyboard-model"}]
sources: [{"chunkId":"api/search-overlay#keyboard-model","url":"/docs/api/search-overlay#keyboard-model","anchor":"keyboard-model"}]
---

The overlay is ask-first and word-count driven: one word runs debounced keyword search with the first result auto-active; a second word switches to ask mode where Enter sends the question to the agentic loop; arrow keys move keyword selection, Escape closes, and suggested questions appear on open with AI enabled. Without a server key, asking returns keyword results with a visible warning — search never breaks.
