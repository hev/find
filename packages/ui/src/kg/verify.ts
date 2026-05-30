import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { buildCorpus } from './build.ts';

const execFileAsync = promisify(execFile);

export interface VerifyAnchorsOptions {
  siteRoot: string;
  collections: string[] | null;
  basePath: string;
  kgContentGlobs?: string[];
  chunkHeadingDepth: number;
  buildCommand?: string;
  distDir?: string;
  skipBuild?: boolean;
}

export interface VerifyAnchorsResult {
  checked: number;
  missing: Array<{ url: string; file: string; anchorId: string }>;
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

  return { checked: anchored.length, missing };
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
