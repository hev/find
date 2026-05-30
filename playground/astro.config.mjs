import { defineConfig } from 'astro/config';
import agenticSearch from '@hev/astro-agentic-search';

// https://astro.build/config
export default defineConfig({
  integrations: [
    agenticSearch({
      collections: ['docs'],
      basePath: '/docs/',
      // model: 'claude-haiku-4-5',
      // maxResults: 6,
    }),
  ],
  // The search endpoint renders on demand. `astro dev` runs it directly.
  // For `astro build`/production, add a server adapter, e.g. @astrojs/node.
});
