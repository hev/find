---
id: "quickstart#3-add-a-server-adapter"
title: "Quick start"
heading: "3. Add a server adapter"
group: "Overview"
order: 92
url: "/docs/quickstart#3-add-a-server-adapter"
anchor: "3-add-a-server-adapter"
terms: ["server","adapter","route","renders","demand","whichever","matches","host","existing","pages","stay","prerendered","only","search","runs","function","docs","site","itself","uses","cloudflare","astro","config","import","astrojs","export","default","defineconfig","platformproxy","enabled","true","integrations","above"]
hash: "795eff804c3ce56e4f62c96e59090a4c4845680aef5ab40735d8a57b33976dcf"
mode: "agent-primary"
facts: [{"kind":"code","literal":"// astro.config.mjs\nimport cloudflare from \"@astrojs/cloudflare\";\n\nexport default defineConfig({\n  adapter: cloudflare({ platformProxy: { enabled: true } }),\n  // ...integrations as above\n});","chunkId":"quickstart#3-add-a-server-adapter"},{"kind":"code","literal":"/api/ask","chunkId":"quickstart#3-add-a-server-adapter"}]
sources: [{"chunkId":"quickstart#3-add-a-server-adapter","url":"/docs/quickstart#3-add-a-server-adapter","anchor":"3-add-a-server-adapter"}]
---

The ask route renders on demand, so add whichever server adapter matches the host; existing pages stay prerendered and only the search route runs as a function. The docs site itself uses Cloudflare.
