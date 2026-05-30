import { getCollection } from 'astro:content';
import { chunkDocument, type Chunk, type SourceDocument } from './chunk';
export { prefilter, type Candidate } from './prefilter';

export type { Chunk } from './chunk';

/**
 * Reads the configured content collections into an in-memory heading chunk
 * index. Built lazily once per server process.
 */
export async function buildIndex(
  collections: string[] | null,
  basePath: string,
  chunkHeadingDepth: number,
): Promise<Chunk[]> {
  if (!collections?.length) {
    throw new Error('[hev-find] No collections configured. Pass `collections: ["docs"]` to the integration.');
  }

  const chunks: Chunk[] = [];
  for (const name of collections) {
    const docs = (await getCollection(name)) as Array<{
      id?: string;
      slug?: string;
      body?: string;
      data?: { title?: string; group?: string; description?: string };
    }>;

    for (const doc of docs) {
      const slug = (doc.slug ?? doc.id ?? '').replace(/\.(md|mdx)$/i, '');
      if (!slug) continue;
      const source: SourceDocument = {
        slug,
        title: doc.data?.title ?? slug,
        group: doc.data?.group,
        description: doc.data?.description,
        body: doc.body ?? '',
      };
      chunks.push(...chunkDocument(source, basePath, chunkHeadingDepth));
    }
  }

  return chunks.sort((a, b) => a.id.localeCompare(b.id));
}
