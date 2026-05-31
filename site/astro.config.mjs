import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import cloudflare from "@astrojs/cloudflare";
import hevAsk from "@hev/ask";

// This site documents hev ask and searches itself with hev ask — the docs
// are the product's own test corpus. Static pages stay prerendered; only the
// on-demand /api/ask route runs as a Cloudflare Pages Function.
export default defineConfig({
	site: "https://ask.hev.dev",
	devToolbar: { enabled: false },
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
