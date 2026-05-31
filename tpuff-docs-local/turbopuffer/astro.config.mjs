import { defineConfig } from 'astro/config';
import hevAsk from '@hev/ask';
import node from '@astrojs/node';

// A larger, denser corpus than the playground/site: ~40 turbopuffer doc pages
// (~600KB) ingested from turbopuffer's published /llms-full.txt. The search
// endpoint renders on demand, so we use the Node adapter; doc pages prerender.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    hevAsk({
      collections: ['docs'],
      basePath: '/docs/',
    }),
  ],
});
