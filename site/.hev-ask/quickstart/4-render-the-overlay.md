---
id: "quickstart#4-render-the-overlay"
title: "Quick start"
heading: "4. Render the overlay"
group: "Overview"
order: 93
url: "/docs/quickstart#4-render-the-overlay"
anchor: "4-render-the-overlay"
terms: ["render","overlay","component","once","global","layout","element","opener","data","attribute","opens","palette","keyboard","shortcut","binds","automatically","point","keyword","search","works","layouts","base","astro","import","searchoverlay","hevmind","components","button","type","open","slot","somewhere","like","bound","press"]
hash: "5c984aa14647046abf4d3804523a339a029e8187d8562f22a9b55f4a3b7e7b33"
mode: "agent-primary"
facts: [{"kind":"code","literal":"---\n// src/layouts/Base.astro\nimport SearchOverlay from \"@hevmind/ask/components/SearchOverlay.astro\";\n---\n\u003cbutton type=\"button\" data-hev-ask-open\u003e\n  Search \u003ckbd\u003e⌘K\u003c/kbd\u003e\n\u003c/button\u003e\n\n\u003cslot /\u003e\n\n\u003cSearchOverlay /\u003e","chunkId":"quickstart#4-render-the-overlay"},{"kind":"code","literal":"data-hev-ask-open","chunkId":"quickstart#4-render-the-overlay"},{"kind":"code","literal":"⌘K","chunkId":"quickstart#4-render-the-overlay"},{"kind":"code","literal":"astro dev","chunkId":"quickstart#4-render-the-overlay"}]
sources: [{"chunkId":"quickstart#4-render-the-overlay","url":"/docs/quickstart#4-render-the-overlay","anchor":"4-render-the-overlay"}]
---

Add the overlay component once in a global layout; any element with the opener data attribute opens the palette and the keyboard shortcut binds automatically. At this point keyword search works in dev.
