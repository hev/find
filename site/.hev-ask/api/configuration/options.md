---
id: "api/configuration#options"
title: "Configuration"
heading: "Options"
group: "API"
order: 12
url: "/docs/api/configuration#options"
anchor: "options"
terms: ["options","full","table","integration","collections","basepath","define","corpus","urls","endpoint","provider","providerbaseurl","model","digestmodel","control","routing","inference","maxresults","answermaxtokens","maxiterations","chunkheadingdepth","candidatepersearch","perdoccap","tune","retrieval","loop","digestdir","digestcontentglobs","locate","committed","tree","build","sources","string","docs","slug","anchor","anthropic","openai","openrouter"]
hash: "3d7084435ad219aa81a8c7a65fc84859b1ef0613d128fa21ec4a2178b4fa7eb9"
mode: "source-primary"
facts: [{"kind":"code","literal":"collections","chunkId":"api/configuration#options"},{"kind":"code","literal":"string[]","chunkId":"api/configuration#options"},{"kind":"code","literal":"basePath","chunkId":"api/configuration#options"},{"kind":"code","literal":"string","chunkId":"api/configuration#options"},{"kind":"code","literal":"'/docs/'","chunkId":"api/configuration#options"},{"kind":"code","literal":"basePath + slug","chunkId":"api/configuration#options"},{"kind":"code","literal":"#anchor","chunkId":"api/configuration#options"},{"kind":"code","literal":"endpoint","chunkId":"api/configuration#options"},{"kind":"code","literal":"'/api/ask'","chunkId":"api/configuration#options"},{"kind":"code","literal":"provider","chunkId":"api/configuration#options"},{"kind":"code","literal":"'anthropic'","chunkId":"api/configuration#options"},{"kind":"code","literal":"'openai'","chunkId":"api/configuration#options"},{"kind":"code","literal":"'openrouter'","chunkId":"api/configuration#options"},{"kind":"code","literal":"ANTHROPIC_API_KEY","chunkId":"api/configuration#options"},{"kind":"code","literal":"OPENAI_API_KEY","chunkId":"api/configuration#options"},{"kind":"code","literal":"OPENROUTER_API_KEY","chunkId":"api/configuration#options"},{"kind":"code","literal":"providerBaseUrl","chunkId":"api/configuration#options"},{"kind":"code","literal":"model","chunkId":"api/configuration#options"},{"kind":"code","literal":"claude-haiku-4-5","chunkId":"api/configuration#options"},{"kind":"code","literal":"gpt-4.1-mini","chunkId":"api/configuration#options"},{"kind":"code","literal":"anthropic/claude-haiku-4.5","chunkId":"api/configuration#options"},{"kind":"code","literal":"digestModel","chunkId":"api/configuration#options"},{"kind":"code","literal":"claude-opus-4-8","chunkId":"api/configuration#options"},{"kind":"code","literal":"gpt-5.1","chunkId":"api/configuration#options"}]
sources: [{"chunkId":"api/configuration#options","url":"/docs/api/configuration#options","anchor":"options"}]
---

Full options table for the integration: collections and basePath define the corpus and URLs; endpoint, provider, providerBaseUrl, model, and digestModel control routing and inference; maxResults, answerMaxTokens, maxIterations, chunkHeadingDepth, candidatePerSearch, and perDocCap tune retrieval and the loop; digestDir and digestContentGlobs locate the committed tree and build sources.
