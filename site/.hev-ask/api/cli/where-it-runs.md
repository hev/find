---
id: "api/cli#where-it-runs"
title: "CLI"
heading: "Where it runs"
group: "API"
order: 9
url: "/docs/api/cli#where-it-runs"
anchor: "where-it-runs"
terms: ["runs","producer","commands","locally","filesystem","access","astro","integration","also","digest","build","during","site","present","falling","back","committed","tree","deployed","reads","through","virtual","module","running","verify","every","mechanical","check","anchors","still","match","renders","anthropic","invokes","anthropicapikey","falls","command","cannot","does","need"]
hash: "3160b534adda5d403ca544d7fa24738f6edc01c050b30b719a2cc04be4a6eede"
mode: "source-primary"
facts: [{"kind":"code","literal":"ask digest build","chunkId":"api/cli#where-it-runs"},{"kind":"code","literal":"astro build","chunkId":"api/cli#where-it-runs"},{"kind":"code","literal":"ANTHROPIC_API_KEY","chunkId":"api/cli#where-it-runs"},{"kind":"code","literal":"virtual:hev-ask/digest","chunkId":"api/cli#where-it-runs"},{"kind":"code","literal":"ask digest verify","chunkId":"api/cli#where-it-runs"}]
sources: [{"chunkId":"api/cli#where-it-runs","url":"/docs/api/cli#where-it-runs","anchor":"where-it-runs"}]
---

Producer commands run locally or in CI with filesystem access; the Astro integration also runs the digest build during the site build when a key is present, falling back to the committed tree. The deployed site reads the tree through a virtual module with no filesystem access, and running verify on every build is the mechanical check that anchors still match what Astro renders.
