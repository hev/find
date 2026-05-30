#!/usr/bin/env node
import { buildKnowledgeGraph } from './build.ts';
import { verifyAnchors } from './verify.ts';

interface Flags {
  collections: string[];
  basePath?: string;
  kgPath?: string;
  kgContentGlobs: string[];
  chunkHeadingDepth?: number;
  kgModel?: string;
  buildCommand?: string;
  skipBuild?: boolean;
}

const [command = 'build', ...args] = process.argv.slice(2);
const flags = parseFlags(args);

try {
  if (command === 'build') {
    const result = await buildKnowledgeGraph({
      siteRoot: process.cwd(),
      collections: flags.collections.length ? flags.collections : ['docs'],
      basePath: flags.basePath ?? '/docs/',
      kgPath: flags.kgPath ?? '.hev-find/kg.json',
      kgContentGlobs: flags.kgContentGlobs.length ? flags.kgContentGlobs : undefined,
      chunkHeadingDepth: flags.chunkHeadingDepth ?? 3,
      kgModel: flags.kgModel ?? 'claude-opus-4-8',
    });
    console.log(`[hev-find] kg:${result.status} ${result.path} (${result.chunks} chunks)`);
  } else if (command === 'verify') {
    const result = await verifyAnchors({
      siteRoot: process.cwd(),
      collections: flags.collections.length ? flags.collections : ['docs'],
      basePath: flags.basePath ?? '/docs/',
      kgContentGlobs: flags.kgContentGlobs.length ? flags.kgContentGlobs : undefined,
      chunkHeadingDepth: flags.chunkHeadingDepth ?? 3,
      buildCommand: flags.buildCommand,
      skipBuild: flags.skipBuild,
    });
    if (result.missing.length) {
      for (const miss of result.missing) {
        console.error(`[hev-find] missing anchor ${miss.anchorId} for ${miss.url} in ${miss.file}`);
      }
      process.exitCode = 1;
    } else {
      console.log(`[hev-find] verified ${result.checked} anchors`);
    }
  } else {
    console.error('Usage: hev-find-kg build|verify [--collection docs] [--base-path /docs/]');
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`[hev-find] ${(err as Error).message}`);
  process.exitCode = 1;
}

function parseFlags(args: string[]): Flags {
  const flags: Flags = { collections: [], kgContentGlobs: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--collection' && next) {
      flags.collections.push(next);
      i += 1;
    } else if (arg === '--base-path' && next) {
      flags.basePath = next;
      i += 1;
    } else if (arg === '--kg-path' && next) {
      flags.kgPath = next;
      i += 1;
    } else if (arg === '--content-glob' && next) {
      flags.kgContentGlobs.push(next);
      i += 1;
    } else if (arg === '--chunk-heading-depth' && next) {
      flags.chunkHeadingDepth = Number(next);
      i += 1;
    } else if (arg === '--kg-model' && next) {
      flags.kgModel = next;
      i += 1;
    } else if (arg === '--build-command' && next) {
      flags.buildCommand = next;
      i += 1;
    } else if (arg === '--skip-build') {
      flags.skipBuild = true;
    }
  }
  return flags;
}
