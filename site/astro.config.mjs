import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import cloudflare from "@astrojs/cloudflare";
import hevFind from "@hev/find";

// This site documents hev find and searches itself with hev find — the docs
// are the product's own test corpus. Static pages stay prerendered; only the
// on-demand /api/find route runs as a Cloudflare Pages Function.
export default defineConfig({
	site: "https://find.hev.dev",
	devToolbar: { enabled: false },
	// Pinned lane so dev fails loudly instead of hopping a neighbour's port.
	server: { port: 4334, strictPort: true },
	adapter: cloudflare({ platformProxy: { enabled: true } }),
	integrations: [
		mdx(),
		hevFind({ collections: ["docs"], basePath: "/docs/" }),
	],
	markdown: {
		syntaxHighlight: false,
	},
});
