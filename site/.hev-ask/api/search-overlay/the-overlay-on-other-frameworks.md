---
id: "api/search-overlay#the-overlay-on-other-frameworks"
title: "SearchOverlay component"
heading: "The overlay on other frameworks"
group: "API"
order: 55
url: "/docs/api/search-overlay#the-overlay-on-other-frameworks"
anchor: "the-overlay-on-other-frameworks"
terms: ["overlay","other","frameworks","same","palette","ships","prebuilt","component","loaded","script","reads","bundled","copy","digest","browser","keyword","search","runs","fully","static","optional","endpoint","attribute","enables","agentic","questions","omit","only","theming","variables","opener","keyboard","model","identical","astro","type","module","https","jsdelivr","hevmind"]
hash: "294cf6be8257ee487de6d9399df7bb94a4a88fbf3c1865008b451588f489d85e"
mode: "source-primary"
facts: [{"kind":"code","literal":"\u003cscript\n  type=\"module\"\n  src=\"https://cdn.jsdelivr.net/npm/@hevmind/ask/overlay.js\"\n  data-hev-ask-digest=\"/hev-ask/\"\n  data-hev-ask-endpoint=\"https://docs-ask.example.workers.dev/api/ask\"\n\u003e\u003c/script\u003e\n\n\u003cbutton data-hev-ask-open\u003eSearch \u003ckbd\u003e⌘K\u003c/kbd\u003e\u003c/button\u003e","chunkId":"api/search-overlay#the-overlay-on-other-frameworks"},{"kind":"code","literal":"SearchOverlay.astro","chunkId":"api/search-overlay#the-overlay-on-other-frameworks"},{"kind":"code","literal":"@hevmind/ask/overlay","chunkId":"api/search-overlay#the-overlay-on-other-frameworks"},{"kind":"code","literal":"data-hev-ask-digest","chunkId":"api/search-overlay#the-overlay-on-other-frameworks"},{"kind":"code","literal":"ask digest bundle","chunkId":"api/search-overlay#the-overlay-on-other-frameworks"},{"kind":"code","literal":"data-hev-ask-endpoint","chunkId":"api/search-overlay#the-overlay-on-other-frameworks"}]
sources: [{"chunkId":"api/search-overlay#the-overlay-on-other-frameworks","url":"/docs/api/search-overlay#the-overlay-on-other-frameworks","anchor":"the-overlay-on-other-frameworks"}]
---

The same palette ships as a prebuilt web component loaded with one script tag from npm or a CDN: it reads a bundled copy of the digest in the browser so keyword search runs fully static, and an optional endpoint attribute enables agentic questions (omit it for keyword-only). Theming variables, the opener attribute, and the keyboard model are identical to the Astro component.
