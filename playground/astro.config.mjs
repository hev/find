import { defineConfig } from 'astro/config';
import hevAsk from '@hev/ask';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    hevAsk({
      collections: ['docs'],
      basePath: '/docs/',
      // model: 'claude-haiku-4-5',
      // maxResults: 6,
    }),
  ],
  // The search endpoint renders on demand, so the playground uses the Node
  // adapter to make `astro build` verifiable.
});
