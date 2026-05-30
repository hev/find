import { tokenize } from '../search/chunk.ts';
import type { GlossaryEntry } from './schema';

export function expandQueryTerms(query: string, glossary: GlossaryEntry[], cap = 24): string[] {
  const terms = new Set(tokenize(query));
  if (!terms.size) return [];

  for (const entry of glossary) {
    if (terms.size >= cap) break;
    const entryTerms = new Set([...tokenize(entry.term), ...entry.aliases.flatMap((alias) => tokenize(alias))]);
    if (!intersects(terms, entryTerms)) continue;
    for (const term of entryTerms) {
      terms.add(term);
      if (terms.size >= cap) break;
    }
  }

  return [...terms];
}

function intersects(a: Set<string>, b: Set<string>): boolean {
  for (const item of b) if (a.has(item)) return true;
  return false;
}
