---
id: "quickstart#2-register-the-integration"
title: "Quick start"
heading: "2. Register the integration"
group: "Overview"
order: 91
url: "/docs/quickstart#2-register-the-integration"
anchor: "2-register-the-integration"
terms: ["register","integration","astro","config","content","collection","name","slug","base","path","collections","only","required","option","import","defineconfig","hevask","hevmind","export","default","integrations","docs","basepath","prefix","must","everything","else","configuration","reference"]
hash: "02f816dd61687ca1704bca5caeb6868ea8d531804bd9dc7ca569c05522811b6d"
mode: "agent-primary"
facts: [{"kind":"code","literal":"// astro.config.mjs\nimport { defineConfig } from \"astro/config\";\nimport hevAsk from \"@hevmind/ask\";\n\nexport default defineConfig({\n  integrations: [\n    hevAsk({\n      collections: [\"docs\"],   // your content collection name(s)\n      basePath: \"/docs/\",      // slug → URL prefix: basePath + slug\n    }),\n  ],\n});","chunkId":"quickstart#2-register-the-integration"},{"kind":"code","literal":"collections","chunkId":"quickstart#2-register-the-integration"}]
sources: [{"chunkId":"quickstart#2-register-the-integration","url":"/docs/quickstart#2-register-the-integration","anchor":"2-register-the-integration"}]
---

Register the integration in the Astro config with the content collection name(s) and the slug-to-URL base path; collections is the only required option.
