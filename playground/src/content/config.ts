import { defineCollection, z } from 'astro:content';

// Mirrors layer/site's `docs` collection schema.
const docs = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    group: z.string().optional(),
    order: z.number().optional(),
  }),
});

export const collections = { docs };
