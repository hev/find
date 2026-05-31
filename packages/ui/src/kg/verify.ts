import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { buildCorpus } from './build.ts';
import { extractFacts } from './facts.ts';
import { normalizeKnowledgeGraph } from './schema.ts';

const execFileAsync = promisify(execFile);

export interface VerifyAnchorsOptions {
  siteRoot: string;
  collections: string[] | null;
  basePath: string;
  kgContentGlobs?: string[];
  chunkHeadingDepth: number;
  kgPath?: string;
  buildCommand?: string;
  distDir?: string;
  skipBuild?: boolean;
}

export interface VerifyAnchorsResult {
  checked: number;
  missing: Array<{ url: string; file: string; anchorId: string }>;
  /** Source literals that the committed graph dropped from an agent-primary node. */
  dropped: Array<{ id: string; literal: string }>;
  /** Section ids present in the corpus but absent from the committed graph. */
  uncovered: string[];
}

export async function verifyAnchors(options: VerifyAnchorsOptions): Promise<VerifyAnchorsResult> {
  if (!options.skipBuild) {
    const command = options.buildCommand ?? 'pnpm build';
    await execFileAsync('sh', ['-c', command], { cwd: options.siteRoot, maxBuffer: 1024 * 1024 * 8 });
  }

  const corpus = await buildCorpus(options);
  const distDir = path.resolve(options.siteRoot, options.distDir ?? 'dist');
  const anchored = corpus.chunks.filter((chunk) => chunk.anchorId);
  const missing: VerifyAnchorsResult['missing'] = [];

  for (const chunk of anchored) {
    const files = htmlFilesForUrl(distDir, chunk.url);
    const found = await findHtmlWithId(files, chunk.anchorId!);
    if (!found) {
      const file = files[0];
      missing.push({ url: chunk.url, file, anchorId: chunk.anchorId! });
    }
  }

  const { dropped, uncovered } = await verifyFidelity(options, corpus.chunks);
  return { checked: anchored.length, missing, dropped, uncovered };
}

/**
 * Literal-fidelity gate: every verbatim literal the builder would extract from a
 * section must be recoverable from that section's committed node — unless the
 * node is source-primary (the agent reads its raw text instead). Catches lossy
 * distillation that would otherwise produce confident-but-wrong exact answers.
 *
 * Reads the committed artifact only; never calls the model.
 */
async function verifyFidelity(
  options: VerifyAnchorsOptions,
  chunks: Awaited<ReturnType<typeof buildCorpus>>['chunks'],
): Promise<{ dropped: VerifyAnchorsResult['dropped']; uncovered: string[] }> {
  const kgPath = path.resolve(options.siteRoot, options.kgPath ?? '.hev-ask/kg.json');
  const kg = normalizeKnowledgeGraph(await readJson(kgPath));
  if (!kg.nodes.length) return { dropped: [], uncovered: [] }; // v1 / degraded graph — nothing to check

  const nodeById = new Map(kg.nodes.map((node) => [node.id, node]));
  const dropped: VerifyAnchorsResult['dropped'] = [];
  const uncovered: string[] = [];

  for (const chunk of chunks) {
    const node = nodeById.get(chunk.id);
    if (!node) {
      uncovered.push(chunk.id);
      continue;
    }
    if (node.mode === 'source-primary') continue;
    const carried = new Set(node.facts.map((fact) => fact.literal));
    for (const fact of extractFacts(chunk.id, chunk.raw)) {
      if (!carried.has(fact.literal)) dropped.push({ id: chunk.id, literal: fact.literal });
    }
  }

  return { dropped, uncovered };
}

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function findHtmlWithId(files: string[], id: string): Promise<boolean> {
  for (const file of files) {
    const html = await readFile(file, 'utf8').catch(() => '');
    if (html && hasId(html, id)) return true;
  }
  return false;
}

function htmlFilesForUrl(distDir: string, url: string): string[] {
  const pathname = url.split('#')[0].replace(/^\//, '').replace(/\/$/, '');
  return [path.join(distDir, pathname, 'index.html'), path.join(distDir, 'client', pathname, 'index.html')];
}

function hasId(html: string, id: string): boolean {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\sid=(["'])${escaped}\\1`).test(html);
}
