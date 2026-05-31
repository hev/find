import GithubSlugger from 'github-slugger';

export interface SourceDocument {
  slug: string;
  title: string;
  group?: string;
  description?: string;
  body: string;
}

export interface Chunk {
  id: string;
  docSlug: string;
  docTitle: string;
  group?: string;
  heading?: string;
  anchorId?: string;
  url: string;
  text: string;
  /** Raw section markdown (pre-clean). Used for verbatim fact extraction; not hashed. */
  raw: string;
  tokens: Set<string>;
}

interface SectionDraft {
  heading?: string;
  anchorId?: string;
  lines: string[];
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

export function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

/**
 * Strip Markdown/MDX syntax so excerpts read as prose. Code content is kept
 * for searchability, but fence markers, tags, tables, and link/emphasis syntax
 * are removed.
 */
export function cleanMarkdown(src: string): string {
  return src
    .replace(/^\s*(import|export)\s.+$/gm, ' ')
    .replace(/```[a-zA-Z0-9]*\n?/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/^\s*\|?[\s:|-]{3,}\|?\s*$/gm, ' ')
    .replace(/\|/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, ' ')
    .replace(/^\s{0,3}>\s?/gm, ' ')
    .replace(/^\s{0,3}[-*+]\s+/gm, ' ')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHeadingText(src: string): string {
  return src
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/[*~]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function docSlugToUrl(slug: string, basePath: string): string {
  const base = basePath.endsWith('/') ? basePath : basePath + '/';
  if (slug === 'index') return base.replace(/\/$/, '') || '/';
  return base + slug.replace(/\/index$/, '');
}

export function chunkDocument(
  doc: SourceDocument,
  basePath: string,
  chunkHeadingDepth = 3,
): Chunk[] {
  const slugger = new GithubSlugger();
  const sections: SectionDraft[] = [{ lines: [] }];
  let current = sections[0];
  const maxDepth = Math.max(2, Math.min(6, chunkHeadingDepth));

  for (const line of doc.body.split(/\r?\n/)) {
    const match = line.match(HEADING_RE);
    if (!match) {
      current.lines.push(line);
      continue;
    }

    const level = match[1].length;
    const heading = cleanHeadingText(match[2]);
    const anchorId = slugger.slug(heading);

    if (level >= 2 && level <= maxDepth) {
      current = { heading, anchorId, lines: [line] };
      sections.push(current);
    } else {
      current.lines.push(line);
    }
  }

  return sections
    .map((section, index): Chunk | null => {
      const rawBody = section.lines.join('\n');
      const cleanedBody = cleanMarkdown(rawBody);
      const introPrefix = index === 0 ? [doc.description, cleanedBody] : [cleanedBody];
      const text = introPrefix.filter(Boolean).join('\n').trim();
      if (!text && !section.heading) return null;

      const url = docSlugToUrl(doc.slug, basePath) + (section.anchorId ? `#${section.anchorId}` : '');
      const id = section.anchorId ? `${doc.slug}#${section.anchorId}` : doc.slug;
      return {
        id,
        docSlug: doc.slug,
        docTitle: doc.title,
        group: doc.group,
        heading: section.heading,
        anchorId: section.anchorId,
        url,
        text,
        raw: rawBody,
        tokens: new Set(tokenize(`${doc.title} ${doc.group ?? ''} ${section.heading ?? ''} ${text}`)),
      };
    })
    .filter((chunk): chunk is Chunk => chunk !== null);
}

export function hashableChunkText(chunks: Pick<Chunk, 'id' | 'text'>[]): string {
  return [...chunks]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((chunk) => `${chunk.id}\n${chunk.text}`)
    .join('\n---\n');
}
