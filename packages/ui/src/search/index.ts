import { getCollection } from 'astro:content';

export interface IndexEntry {
  id: string;
  title: string;
  group?: string;
  url: string;
  /** Concatenated searchable text (description + body). */
  text: string;
  tokens: Set<string>;
}

export interface Candidate {
  id: string;
  title: string;
  group?: string;
  /** A short excerpt around the first query match, for the model to read. */
  snippet: string;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/**
 * Strip Markdown/MDX syntax so excerpts read as prose. Code *content* is kept
 * (for searchability) but fence markers, tags, tables, and link/emphasis
 * syntax are removed.
 */
function cleanMarkdown(src: string): string {
  return src
    .replace(/^\s*(import|export)\s.+$/gm, ' ') // MDX import/export lines
    .replace(/```[a-zA-Z0-9]*\n?/g, ' ') // code fence markers (keep code text)
    .replace(/`([^`]+)`/g, '$1') // inline code -> text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images -> alt text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links -> link text
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ') // JSX/HTML tags
    .replace(/^\s*\|?[\s:|-]{3,}\|?\s*$/gm, ' ') // table separator rows
    .replace(/\|/g, ' ') // remaining table pipes
    .replace(/^\s{0,3}#{1,6}\s+/gm, ' ') // heading markers
    .replace(/^\s{0,3}>\s?/gm, ' ') // blockquote markers
    .replace(/^\s{0,3}[-*+]\s+/gm, ' ') // list bullets
    .replace(/[*_~]{1,3}/g, '') // emphasis markers
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Reads the configured content collections into an in-memory keyword index.
 * Built lazily once per server process.
 */
export async function buildIndex(
  collections: string[] | null,
  basePath: string,
): Promise<IndexEntry[]> {
  if (!collections?.length) {
    throw new Error(
      '[agentic-search] No collections configured. Pass `collections: ["docs"]` to the integration.',
    );
  }
  const base = basePath.endsWith('/') ? basePath : basePath + '/';
  const entries: IndexEntry[] = [];

  // Map a content id to its page URL. Index files map to their directory root
  // (`index` -> base, `a/b/index` -> base + `a/b`), matching common docs routing.
  const toUrl = (id: string): string => {
    if (id === 'index') return base.replace(/\/$/, '') || '/';
    const trimmed = id.replace(/\/index$/, '');
    return base + trimmed;
  };

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
      const title = doc.data?.title ?? slug;
      const group = doc.data?.group;
      const description = doc.data?.description ?? '';
      const body = doc.body ?? '';
      const text = `${description}\n${cleanMarkdown(body)}`.trim();
      entries.push({
        id: slug,
        title,
        group,
        url: toUrl(slug),
        text,
        tokens: new Set(tokenize(`${title} ${group ?? ''} ${text}`)),
      });
    }
  }

  return entries;
}

/**
 * Keyword prefilter: returns the highest-overlap documents for a query, each
 * with a small excerpt. These candidates are handed to the model to rerank.
 */
export function prefilter(index: IndexEntry[], query: string, pool: number): Candidate[] {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length) return [];

  const scored = index
    .map((entry) => {
      let score = 0;
      for (const term of terms) if (entry.tokens.has(term)) score += 1;
      return { entry, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, pool);

  return scored.map(({ entry }) => ({
    id: entry.id,
    title: entry.title,
    group: entry.group,
    snippet: excerpt(entry.text, terms),
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
  return (start > 0 ? '…' : '') + slice + (start + radius < text.length ? '…' : '');
}
