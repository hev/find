export interface GlossaryEntry {
  term: string;
  aliases: string[];
  definition: string;
}

/** A byte-verbatim literal lifted from a source section (a flag, code span, value). */
export interface Fact {
  kind: 'flag' | 'code' | 'value' | 'default' | 'key';
  /** Exact text as it appears in the source — never paraphrased by the model. */
  literal: string;
  /** The chunk id this literal was extracted from. */
  chunkId: string;
}

/** Where a node's knowledge came from, and the human deep link for it. */
export interface SourceRef {
  /** Equals a Chunk.id. */
  chunkId: string;
  /** The rendered deep link, e.g. "/docs/concepts#kubernetes-autoscaling". */
  url: string;
  /** The github-slugger anchor, or null for a page-level (intro) section. */
  anchor: string | null;
}

/**
 * One distilled, source-grounded section of the docs — the agent's "shadow site"
 * view of a single heading section. `id` equals the originating chunk id.
 */
export interface KnowledgeNode {
  id: string;
  kind: 'section';
  title: string;
  heading: string | null;
  group: string | null;
  url: string;
  /** Model-distilled prose. May paraphrase; exact strings live in `facts`. */
  summary: string;
  /** Deterministically extracted verbatim literals. */
  facts: Fact[];
  /** Provenance — for a section node, its own chunk. */
  sources: SourceRef[];
  /**
   * 'source-primary' sections (reference/API) carry dense literals the agent
   * should read verbatim rather than trust a paraphrase of.
   */
  mode: 'agent-primary' | 'source-primary';
  /** Distinctive tokens used for the render-time link-support check. */
  terms: string[];
}

/** Reserved for the deferred edge layer; ships empty in this version. */
export interface KnowledgeEdge {
  rel: string;
  from: string;
  to: string;
}

export interface KnowledgeGraph {
  version: 2;
  generatedAt: string;
  contentHash: string;
  /** Compact prose orientation. Degradation fallback when `nodes` is empty. */
  context: string;
  glossary: GlossaryEntry[];
  /** Deterministic high-level map injected into the agent's system prompt. */
  overview: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
}

export const EMPTY_KG: KnowledgeGraph = {
  version: 2,
  generatedAt: '',
  contentHash: '',
  context: '',
  glossary: [],
  overview: '',
  nodes: [],
  edges: [],
};

const FACT_KINDS = new Set<Fact['kind']>(['flag', 'code', 'value', 'default', 'key']);
const NODE_MODES = new Set<KnowledgeNode['mode']>(['agent-primary', 'source-primary']);

/**
 * Coerces unknown JSON into a KnowledgeGraph. A v1 artifact (`{context,
 * glossary}` with no `nodes`) degrades cleanly to an empty-node v2 graph, so the
 * runtime falls back to keyword/legacy behavior rather than hard-failing.
 */
export function normalizeKnowledgeGraph(value: unknown): KnowledgeGraph {
  if (!value || typeof value !== 'object') return EMPTY_KG;
  const maybe = value as Partial<KnowledgeGraph>;
  const glossary = Array.isArray(maybe.glossary)
    ? maybe.glossary
        .map((entry) => normalizeGlossaryEntry(entry))
        .filter((entry): entry is GlossaryEntry => entry !== null)
    : [];
  const nodes = Array.isArray(maybe.nodes)
    ? maybe.nodes.map((node) => normalizeNode(node)).filter((node): node is KnowledgeNode => node !== null)
    : [];
  const edges = Array.isArray(maybe.edges)
    ? maybe.edges.map((edge) => normalizeEdge(edge)).filter((edge): edge is KnowledgeEdge => edge !== null)
    : [];

  return {
    version: 2,
    generatedAt: typeof maybe.generatedAt === 'string' ? maybe.generatedAt : '',
    contentHash: typeof maybe.contentHash === 'string' ? maybe.contentHash : '',
    context: typeof maybe.context === 'string' ? maybe.context : '',
    glossary,
    overview: typeof maybe.overview === 'string' ? maybe.overview : '',
    nodes,
    edges,
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

function normalizeNode(value: unknown): KnowledgeNode | null {
  if (!value || typeof value !== 'object') return null;
  const maybe = value as Partial<KnowledgeNode>;
  if (typeof maybe.id !== 'string' || typeof maybe.url !== 'string') return null;
  return {
    id: maybe.id,
    kind: 'section',
    title: typeof maybe.title === 'string' ? maybe.title : maybe.id,
    heading: typeof maybe.heading === 'string' ? maybe.heading : null,
    group: typeof maybe.group === 'string' ? maybe.group : null,
    url: maybe.url,
    summary: typeof maybe.summary === 'string' ? maybe.summary : '',
    facts: Array.isArray(maybe.facts)
      ? maybe.facts.map((fact) => normalizeFact(fact)).filter((fact): fact is Fact => fact !== null)
      : [],
    sources: Array.isArray(maybe.sources)
      ? maybe.sources.map((src) => normalizeSource(src)).filter((src): src is SourceRef => src !== null)
      : [],
    mode: maybe.mode && NODE_MODES.has(maybe.mode) ? maybe.mode : 'agent-primary',
    terms: Array.isArray(maybe.terms) ? maybe.terms.filter((term): term is string => typeof term === 'string') : [],
  };
}

function normalizeFact(value: unknown): Fact | null {
  if (!value || typeof value !== 'object') return null;
  const maybe = value as Partial<Fact>;
  if (typeof maybe.literal !== 'string' || !maybe.literal) return null;
  return {
    kind: maybe.kind && FACT_KINDS.has(maybe.kind) ? maybe.kind : 'value',
    literal: maybe.literal,
    chunkId: typeof maybe.chunkId === 'string' ? maybe.chunkId : '',
  };
}

function normalizeSource(value: unknown): SourceRef | null {
  if (!value || typeof value !== 'object') return null;
  const maybe = value as Partial<SourceRef>;
  if (typeof maybe.chunkId !== 'string' || typeof maybe.url !== 'string') return null;
  return {
    chunkId: maybe.chunkId,
    url: maybe.url,
    anchor: typeof maybe.anchor === 'string' ? maybe.anchor : null,
  };
}

function normalizeEdge(value: unknown): KnowledgeEdge | null {
  if (!value || typeof value !== 'object') return null;
  const maybe = value as Partial<KnowledgeEdge>;
  if (typeof maybe.rel !== 'string' || typeof maybe.from !== 'string' || typeof maybe.to !== 'string') return null;
  return { rel: maybe.rel, from: maybe.from, to: maybe.to };
}
