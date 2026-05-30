import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { callClaude, type AnthropicTool } from '../llm.ts';
import { chunkDocument, hashableChunkText, type Chunk, type SourceDocument } from '../search/chunk.ts';
import { parseFrontmatter } from './frontmatter.ts';
import { normalizeKnowledgeGraph, type KnowledgeGraph } from './schema.ts';

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
  description: 'Emit a compact documentation knowledge graph for search retrieval and ranking.',
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
    },
    required: ['context', 'glossary'],
  },
};

export async function buildKnowledgeGraph(options: KnowledgeGraphBuildOptions): Promise<KnowledgeGraphBuildResult> {
  const corpus = await buildCorpus(options);
  const outPath = path.resolve(options.siteRoot, options.kgPath);
  const existing = await readExistingKg(outPath);
  if (existing?.contentHash === corpus.contentHash) {
    return { status: 'skipped', path: outPath, contentHash: corpus.contentHash, chunks: corpus.chunks.length };
  }

  const apiKey = options.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required to build a fresh knowledge graph.');

  const corpusText = corpus.chunks
    .map((chunk) => {
      const title = chunk.heading ? `${chunk.docTitle} > ${chunk.heading}` : chunk.docTitle;
      return `id: ${chunk.id}\nurl: ${chunk.url}\ntitle: ${title}\n\n${chunk.text}`;
    })
    .join('\n\n---\n\n');

  const response = await callClaude({
    apiKey,
    model: options.kgModel,
    maxTokens: 4096,
    system: [
      {
        type: 'text',
        text:
          'You build compact knowledge graphs for documentation search. Return only the forced tool call. Prefer concise context and aliases that real users would type.',
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
          'Create a domain context table and glossary for this corpus. Keep context compact enough to reuse in a search system prompt.',
      },
    ],
    tools: [KG_TOOL],
    toolChoice: { type: 'tool', name: 'emit_knowledge_graph' },
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use' && block.name === 'emit_knowledge_graph');
  const generated = normalizeKnowledgeGraph(toolUse?.type === 'tool_use' ? toolUse.input : null);
  const graph: KnowledgeGraph = {
    version: 1,
    generatedAt: new Date().toISOString(),
    contentHash: corpus.contentHash,
    context: generated.context,
    glossary: generated.glossary,
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(graph, null, 2) + '\n', 'utf8');
  return { status: 'built', path: outPath, contentHash: corpus.contentHash, chunks: corpus.chunks.length };
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
