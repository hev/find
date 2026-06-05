import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import cloudflare from "@astrojs/cloudflare";
import hevAsk from "@hevmind/ask";

// This site documents hev ask and searches itself with hev ask — the docs
// are the product's own test corpus. Static pages stay prerendered; only the
// on-demand /api/ask route runs as a Cloudflare Pages Function.
export default defineConfig({
	site: "https://askhev.com",
	devToolbar: { enabled: false },
	// The digest page lived at /kg before the rename; keep old links working.
	redirects: { "/kg": "/digest", "/docs/api/knowledge-graph": "/docs/api/digest" },
	// Pinned lane so dev fails loudly instead of hopping a neighbour's port.
	server: { port: 4334, strictPort: true },
	adapter: cloudflare({ platformProxy: { enabled: true } }),
	integrations: [
		mdx(),
		hevAsk({ collections: ["docs"], basePath: "/docs/" }),
	],
	markdown: {
		syntaxHighlight: false,
	},
});
