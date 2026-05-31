import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Same shape the package expects: title + group drive the index and KG; the
// ingested turbopuffer pages carry a description too.
const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    group: z.string().optional(),
  }),
});

export const collections = { docs };
