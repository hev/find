---
id: "api/search-overlay#vitepress"
title: "SearchOverlay component"
heading: "VitePress"
group: "API"
order: 58
url: "/docs/api/search-overlay#vitepress"
anchor: "vitepress"
terms: ["vitepress","bundle","goes","public","directory","overlay","mounted","theme","enhance","hook","digest","endpoint","settings","index","import","defaulttheme","mounthevask","hevmind","export","default","extends","enhanceapp","typeof","window","undefined","meta","vite","register","viteaskendpoint"]
hash: "c5725004205e727e67ddb65cabf811a187df397a10d72e5bb48afc6e9e7712ba"
mode: "source-primary"
facts: [{"kind":"code","literal":"// .vitepress/theme/index.ts\nimport DefaultTheme from \"vitepress/theme\";\nimport { mountHevAsk } from \"@hevmind/ask/overlay\";\n\nexport default {\n  extends: DefaultTheme,\n  enhanceApp() {\n    if (typeof window !== \"undefined\") {\n      mountHevAsk({ digest: \"/hev-ask/\", endpoint: import.meta.env.VITE_ASK_ENDPOINT });\n    }\n  },\n};","chunkId":"api/search-overlay#vitepress"},{"kind":"code","literal":".vitepress/public/","chunkId":"api/search-overlay#vitepress"}]
sources: [{"chunkId":"api/search-overlay#vitepress","url":"/docs/api/search-overlay#vitepress","anchor":"vitepress"}]
---

On VitePress, the bundle goes into the public directory and the overlay is mounted from the theme's enhance-app hook with digest and endpoint settings.
