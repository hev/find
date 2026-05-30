import type { GlossaryEntry } from '../kg/schema';
import { expandQueryTerms } from '../kg/expand.ts';
import type { Chunk } from './chunk';

export interface Candidate {
  id: string;
  docTitle: string;
  group?: string;
  heading?: string;
  snippet: string;
}

/**
 * Keyword prefilter over heading chunks. Query terms are widened through the
 * knowledge graph glossary, then capped per document so one page cannot crowd
 * out the rest of the result set.
 */
export function prefilter(
  chunks: Chunk[],
  query: string,
  glossary: GlossaryEntry[],
  pool: number,
  perDocCap: number,
): Candidate[] {
  const terms = expandQueryTerms(query, glossary);
  if (!terms.length) return [];

  const scored = chunks
    .map((chunk) => {
      let score = 0;
      for (const term of terms) if (chunk.tokens.has(term)) score += 1;
      return { chunk, score };
    })
    .filter((candidate) => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.id.localeCompare(b.chunk.id));

  const perDoc = new Map<string, number>();
  const capped = [];
  for (const item of scored) {
    const count = perDoc.get(item.chunk.docSlug) ?? 0;
    if (count >= perDocCap) continue;
    perDoc.set(item.chunk.docSlug, count + 1);
    capped.push(item);
    if (capped.length >= pool) break;
  }

  return capped.map(({ chunk }) => ({
    id: chunk.id,
    docTitle: chunk.docTitle,
    group: chunk.group,
    heading: chunk.heading,
    snippet: excerpt(chunk.text, terms),
  }));
}

function excerpt(text: string, terms: string[], radius = 200): string {
  const lower = text.toLowerCase();
  let pos = -1;
  for (const term of terms) {
    const i = lower.indexOf(term);
    if (i !== -1 && (pos === -1 || i < pos)) pos = i;
  }
  const start = pos === -1 ? 0 : Math.max(0, pos - 40);
  const slice = text.slice(start, start + radius).replace(/\s+/g, ' ').trim();
  return (start > 0 ? '...' : '') + slice + (start + radius < text.length ? '...' : '');
}
