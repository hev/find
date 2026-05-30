export interface GlossaryEntry {
  term: string;
  aliases: string[];
  definition: string;
}

export interface KnowledgeGraph {
  version: 1;
  generatedAt: string;
  contentHash: string;
  context: string;
  glossary: GlossaryEntry[];
}

export const EMPTY_KG: KnowledgeGraph = {
  version: 1,
  generatedAt: '',
  contentHash: '',
  context: '',
  glossary: [],
};

export function normalizeKnowledgeGraph(value: unknown): KnowledgeGraph {
  if (!value || typeof value !== 'object') return EMPTY_KG;
  const maybe = value as Partial<KnowledgeGraph>;
  const glossary = Array.isArray(maybe.glossary)
    ? maybe.glossary
        .map((entry) => normalizeGlossaryEntry(entry))
        .filter((entry): entry is GlossaryEntry => entry !== null)
    : [];

  return {
    version: 1,
    generatedAt: typeof maybe.generatedAt === 'string' ? maybe.generatedAt : '',
    contentHash: typeof maybe.contentHash === 'string' ? maybe.contentHash : '',
    context: typeof maybe.context === 'string' ? maybe.context : '',
    glossary,
  };
}

function normalizeGlossaryEntry(value: unknown): GlossaryEntry | null {
  if (!value || typeof value !== 'object') return null;
  const maybe = value as Partial<GlossaryEntry>;
  if (typeof maybe.term !== 'string' || typeof maybe.definition !== 'string') return null;
  return {
    term: maybe.term,
    aliases: Array.isArray(maybe.aliases) ? maybe.aliases.filter((alias): alias is string => typeof alias === 'string') : [],
    definition: maybe.definition,
  };
}
