import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { callClaude, type AnthropicTool } from '../llm.ts';
import { chunkDocument, hashableChunkText, type Chunk, type SourceDocument } from '../search/chunk.ts';
import { classifyMode, distinctiveTokens, extractFacts } from './facts.ts';
import { parseFrontmatter } from './frontmatter.ts';
import { normalizeKnowledgeGraph, type KnowledgeGraph, type KnowledgeNode } from './schema.ts';

export interface KnowledgeGraphBuildOptions {
  siteRoot: string;
  collections: string[] | null;
  basePath: string;
  kgPath: string;
  kgContentGlobs?: string[];
  chunkHeadingDepth: number;
  kgModel: string;
  apiKey?: string;
}

export interface CorpusBuild {
  documents: SourceDocument[];
  chunks: Chunk[];
  contentHash: string;
}

export interface KnowledgeGraphBuildResult {
  status: 'built' | 'skipped';
  path: string;
  contentHash: string;
  chunks: number;
}

const KG_TOOL: AnthropicTool = {
  name: 'emit_knowledge_graph',
  description:
    'Emit a documentation knowledge graph: a compact orientation, a glossary, and one distilled summary per section.',
  input_schema: {
    type: 'object',
    properties: {
      context: {
        type: 'string',
        description:
          'Compact markdown orientation explaining the product, core concepts, feature areas, and how users talk about them.',
      },
      glossary: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            term: { type: 'string' },
            aliases: { type: 'array', items: { type: 'string' } },
            definition: { type: 'string' },
          },
          required: ['term', 'aliases', 'definition'],
        },
      },
      summaries: {
        type: 'array',
        description:
          'One entry per section id in the corpus. The summary is the agent-facing distillation of that section.',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The exact section id from the corpus.' },
            summary: {
              type: 'string',
              description:
                'A tight 1-3 sentence distillation of the section a search agent can answer from. Paraphrase prose; do NOT restate code, flags, or exact identifiers (those are preserved separately).',
            },
          },
          required: ['id', 'summary'],
        },
      },
      suggestions: {
        type: 'array',
        description:
          '3-5 natural questions a real reader might ask that these docs genuinely answer. Phrase them the way a user would type them, not as headings.',
        items: { type: 'string' },
      },
    },
    required: ['context', 'glossary', 'summaries', 'suggestions'],
  },
};

export interface EmittedDistillation {
  context: string;
  glossary: KnowledgeGraph['glossary'];
  summaries: Array<{ id: string; summary: string }>;
  suggestions: string[];
}

/** The exact model-input payload the skill (or `build`) distils from. */
export interface KnowledgeGraphInput {
  contentHash: string;
  kgPath: string;
  /** True when the committed kg.json already matches this corpus — no rebuild needed. */
  upToDate: boolean;
  sections: Array<{ id: string; url: string; title: string; text: string }>;
}

/** Sections handed to the model: one entry per heading chunk. */
export function corpusSections(corpus: CorpusBuild): KnowledgeGraphInput['sections'] {
  return corpus.chunks.map((chunk) => ({
    id: chunk.id,
    url: chunk.url,
    title: chunk.heading ? `${chunk.docTitle} > ${chunk.heading}` : chunk.docTitle,
    text: chunk.text,
  }));
}

/**
 * Assembles the committed graph from a model distillation. Everything but the
 * distilled fields (`summary`, `glossary`, `context`, `suggestions`) is derived
 * here deterministically, so it is identical whether the distillation came from
 * the API or a Claude Code skill.
 */
export function assembleGraph(emitted: EmittedDistillation, corpus: CorpusBuild): KnowledgeGraph {
  const summaryById = new Map(emitted.summaries.map((entry) => [entry.id, entry.summary]));
  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    contentHash: corpus.contentHash,
    context: emitted.context,
    glossary: emitted.glossary,
    overview: buildOverview(corpus.chunks),
    suggestions: emitted.suggestions,
    nodes: buildNodes(corpus.chunks, summaryById),
    edges: [],
  };
}

export async function buildKnowledgeGraph(options: KnowledgeGraphBuildOptions): Promise<KnowledgeGraphBuildResult> {
  const corpus = await buildCorpus(options);
  const outPath = path.resolve(options.siteRoot, options.kgPath);
  const existing = await readExistingKg(outPath);
  // Skip only when the committed artifact is already a current-version graph with
  // nodes built from this exact corpus. A v1 (node-less) artifact always rebuilds.
  if (existing && existing.version === 2 && existing.contentHash === corpus.contentHash && existing.nodes.length > 0) {
    return { status: 'skipped', path: outPath, contentHash: corpus.contentHash, chunks: corpus.chunks.length };
  }

  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required to build a fresh knowledge graph.');

  const corpusText = corpusSections(corpus)
    .map((section) => `id: ${section.id}\nurl: ${section.url}\ntitle: ${section.title}\n\n${section.text}`)
    .join('\n\n---\n\n');

  const response = await callClaude({
    apiKey,
    model: options.kgModel,
    maxTokens: 8192,
    system: [
      {
        type: 'text',
        text: KG_SYSTEM_PROMPT,
      },
      {
        type: 'text',
        text: `<corpus>\n${corpusText}\n</corpus>`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content:
          'Emit the context, glossary, one summary per section id, and 3-5 suggested questions. Every id in the corpus must get a summary.',
      },
    ],
    tools: [KG_TOOL],
    toolChoice: { type: 'tool', name: 'emit_knowledge_graph' },
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use' && block.name === 'emit_knowledge_graph');
  const emitted = parseEmittedGraph(toolUse?.type === 'tool_use' ? toolUse.input : null);
  const graph = assembleGraph(emitted, corpus);

  await writeGraph(outPath, graph);
  return { status: 'built', path: outPath, contentHash: corpus.contentHash, chunks: corpus.chunks.length };
}

/** Shared instruction for the model step, whether it runs via API or a skill. */
export const KG_SYSTEM_PROMPT =
  'You build documentation knowledge graphs for an AI search agent. Return only the forced tool call. Write a compact orientation, a glossary with aliases real users would type, one tight summary for every section id in the corpus, and 3-5 natural questions a reader might ask that these docs answer. Summaries are what the agent reasons from, so make them faithful and self-contained; paraphrase prose but never restate code, flags, or exact identifiers.';

/** Reads the forced tool call (or a skill's distillation file) into the emit shape. */
export function parseEmittedGraph(input: unknown): EmittedDistillation {
  const base = normalizeKnowledgeGraph(input);
  const raw = (input ?? {}) as { summaries?: unknown };
  const summaries = Array.isArray(raw.summaries)
    ? raw.summaries
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          const maybe = entry as { id?: unknown; summary?: unknown };
          if (typeof maybe.id !== 'string' || typeof maybe.summary !== 'string') return null;
          return { id: maybe.id, summary: maybe.summary.trim() };
        })
        .filter((entry): entry is { id: string; summary: string } => entry !== null)
    : [];
  return { context: base.context, glossary: base.glossary, summaries, suggestions: base.suggestions };
}

async function writeGraph(outPath: string, graph: KnowledgeGraph): Promise<void> {
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(graph, null, 2) + '\n', 'utf8');
}

/**
 * `corpus` command: chunk the content and write the model-input payload (plus a
 * freshness flag) for a Claude Code skill to distil. Fully deterministic, keyless.
 */
export async function writeCorpusInput(options: {
  siteRoot: string;
  collections: string[] | null;
  basePath: string;
  kgPath: string;
  outPath: string;
  kgContentGlobs?: string[];
  chunkHeadingDepth: number;
}): Promise<{ path: string; upToDate: boolean; sections: number }> {
  const corpus = await buildCorpus(options);
  const committed = await readExistingKg(path.resolve(options.siteRoot, options.kgPath));
  const upToDate = Boolean(
    committed && committed.version === 2 && committed.contentHash === corpus.contentHash && committed.nodes.length > 0,
  );
  const payload: KnowledgeGraphInput = {
    contentHash: corpus.contentHash,
    kgPath: options.kgPath,
    upToDate,
    sections: corpusSections(corpus),
  };
  const outPath = path.resolve(options.siteRoot, options.outPath);
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return { path: outPath, upToDate, sections: payload.sections.length };
}

/**
 * `assemble` command: read a skill-produced distillation, re-chunk the content
 * from disk, and write the committed graph with the deterministic parts computed
 * in code. Keyless — the model never runs here.
 */
export async function assembleFromDistillation(options: {
  siteRoot: string;
  collections: string[] | null;
  basePath: string;
  kgPath: string;
  inputPath: string;
  kgContentGlobs?: string[];
  chunkHeadingDepth: number;
}): Promise<KnowledgeGraphBuildResult> {
  const inputPath = path.resolve(options.siteRoot, options.inputPath);
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(inputPath, 'utf8'));
  } catch {
    throw new Error(`Could not read distillation JSON at ${options.inputPath}. Run \`hev-find-kg corpus\` first.`);
  }
  const corpus = await buildCorpus(options);
  const graph = assembleGraph(parseEmittedGraph(raw), corpus);
  const outPath = path.resolve(options.siteRoot, options.kgPath);
  await writeGraph(outPath, graph);
  return { status: 'built', path: outPath, contentHash: corpus.contentHash, chunks: corpus.chunks.length };
}

/** Assembles section nodes. Everything but `summary` is derived deterministically. */
export function buildNodes(chunks: Chunk[], summaryById: Map<string, string>): KnowledgeNode[] {
  return chunks
    .map((chunk): KnowledgeNode => {
      const facts = extractFacts(chunk.id, chunk.raw);
      const summary = summaryById.get(chunk.id)?.trim() || excerpt(chunk.text);
      const terms = distinctiveTokens(
        [chunk.heading ?? '', summary, facts.map((fact) => fact.literal).join(' '), chunk.text].join(' '),
      );
      return {
        id: chunk.id,
        kind: 'section',
        title: chunk.docTitle,
        heading: chunk.heading ?? null,
        group: chunk.group ?? null,
        url: chunk.url,
        summary,
        facts,
        sources: [{ chunkId: chunk.id, url: chunk.url, anchor: chunk.anchorId ?? null }],
        mode: classifyMode(chunk.group),
        terms,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Deterministic grouped table of contents — the agent's cheap high-level map. */
export function buildOverview(chunks: Chunk[]): string {
  const byGroup = new Map<string, Chunk[]>();
  for (const chunk of chunks) {
    const group = chunk.group ?? 'Docs';
    (byGroup.get(group) ?? byGroup.set(group, []).get(group)!).push(chunk);
  }
  const lines: string[] = [];
  for (const [group, items] of [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`## ${group}`);
    for (const chunk of items) {
      lines.push(`- ${chunk.heading ?? chunk.docTitle} — \`${chunk.id}\``);
    }
  }
  return lines.join('\n');
}

function excerpt(text: string, max = 220): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? trimmed.slice(0, max).trimEnd() + '…' : trimmed;
}

export async function buildCorpus(options: {
  siteRoot: string;
  collections: string[] | null;
  basePath: string;
  kgContentGlobs?: string[];
  chunkHeadingDepth: number;
}): Promise<CorpusBuild> {
  const files = await resolveContentFiles(options.siteRoot, options.collections, options.kgContentGlobs);
  const documents = await Promise.all(
    files.map(async (file) => {
      const raw = await readFile(file, 'utf8');
      const { data, body } = parseFrontmatter(raw);
      const slug = slugFromFile(options.siteRoot, file, options.collections);
      return {
        slug,
        title: typeof data.title === 'string' ? data.title : slug,
        group: typeof data.group === 'string' ? data.group : undefined,
        description: typeof data.description === 'string' ? data.description : undefined,
        body,
      } satisfies SourceDocument;
    }),
  );

  const chunks = documents
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .flatMap((doc) => chunkDocument(doc, options.basePath, options.chunkHeadingDepth))
    .sort((a, b) => a.id.localeCompare(b.id));
  const contentHash = sha256(hashableChunkText(chunks));
  return { documents, chunks, contentHash };
}

export function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

async function readExistingKg(file: string): Promise<KnowledgeGraph | null> {
  try {
    return normalizeKnowledgeGraph(JSON.parse(await readFile(file, 'utf8')));
  } catch {
    return null;
  }
}

async function resolveContentFiles(
  siteRoot: string,
  collections: string[] | null,
  kgContentGlobs: string[] | undefined,
): Promise<string[]> {
  const collectionsForDefault = collections?.length ? collections : ['docs'];
  const globs =
    kgContentGlobs?.length
      ? kgContentGlobs
      : collectionsForDefault.map((collection) => `src/content/${collection}/**/*.{md,mdx}`);
  const files = new Set<string>();

  for (const glob of globs) {
    for (const file of await filesForGlob(siteRoot, glob)) files.add(file);
  }

  return [...files].sort((a, b) => a.localeCompare(b));
}

async function filesForGlob(siteRoot: string, glob: string): Promise<string[]> {
  const normalized = glob.replace(/\\/g, '/');
  const rootPart = globRoot(normalized);
  const root = path.resolve(siteRoot, rootPart);
  const all = await walk(root).catch(() => []);
  const re = globToRegex(normalized);
  return all.filter((file) => re.test(path.relative(siteRoot, file).replace(/\\/g, '/')));
}

function globRoot(glob: string): string {
  const wildcard = glob.search(/[*{]/);
  if (wildcard === -1) return path.dirname(glob);
  const before = glob.slice(0, wildcard);
  return before.replace(/[/\\][^/\\]*$/, '') || '.';
}

function globToRegex(glob: string): RegExp {
  let pattern = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  pattern = pattern.replace(/\\\{([^}]+)\\\}/g, (_, inner: string) => `(${inner.split(',').map(escapeRegex).join('|')})`);
  pattern = pattern.replace(/\*\*\/?/g, '::GLOBSTAR::');
  pattern = pattern.replace(/\*/g, '[^/]*');
  pattern = pattern.replace(/::GLOBSTAR::/g, '(?:.*/)?');
  return new RegExp(`^${pattern}$`);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const file = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(file) : [file];
    }),
  );
  return files.flat();
}

function slugFromFile(siteRoot: string, file: string, collections: string[] | null): string {
  const normalizedFile = path.resolve(file);
  const collectionNames = collections?.length ? collections : ['docs'];
  for (const collection of collectionNames) {
    const root = path.resolve(siteRoot, 'src/content', collection);
    const rel = path.relative(root, normalizedFile);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) return cleanSlug(rel);
  }

  return cleanSlug(path.relative(path.resolve(siteRoot, 'src/content'), normalizedFile));
}

function cleanSlug(rel: string): string {
  return rel.replace(/\\/g, '/').replace(/\.(md|mdx)$/i, '').replace(/\/index$/, '');
}
