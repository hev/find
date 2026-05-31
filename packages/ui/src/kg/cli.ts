#!/usr/bin/env node
import { assembleFromDistillation, buildKnowledgeGraph, writeCorpusInput } from './build.ts';
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
  strict?: boolean;
  out?: string;
  input?: string;
}

const [command = 'build', ...args] = process.argv.slice(2);
const flags = parseFlags(args);

try {
  if (command === 'build') {
    const result = await buildKnowledgeGraph({
      siteRoot: process.cwd(),
      collections: flags.collections.length ? flags.collections : ['docs'],
      basePath: flags.basePath ?? '/docs/',
      kgPath: flags.kgPath ?? '.hev-ask/kg.json',
      kgContentGlobs: flags.kgContentGlobs.length ? flags.kgContentGlobs : undefined,
      chunkHeadingDepth: flags.chunkHeadingDepth ?? 3,
      kgModel: flags.kgModel ?? 'claude-opus-4-8',
    });
    console.log(`[hev-ask] kg:${result.status} ${result.path} (${result.chunks} chunks)`);
  } else if (command === 'corpus') {
    const result = await writeCorpusInput({
      siteRoot: process.cwd(),
      collections: flags.collections.length ? flags.collections : ['docs'],
      basePath: flags.basePath ?? '/docs/',
      kgPath: flags.kgPath ?? '.hev-ask/kg.json',
      outPath: flags.out ?? '.hev-ask/kg-input.json',
      kgContentGlobs: flags.kgContentGlobs.length ? flags.kgContentGlobs : undefined,
      chunkHeadingDepth: flags.chunkHeadingDepth ?? 3,
    });
    const state = result.upToDate ? 'up-to-date' : 'needs-rebuild';
    console.log(`[hev-ask] kg:corpus ${result.path} (${result.sections} sections, ${state})`);
  } else if (command === 'assemble') {
    const result = await assembleFromDistillation({
      siteRoot: process.cwd(),
      collections: flags.collections.length ? flags.collections : ['docs'],
      basePath: flags.basePath ?? '/docs/',
      kgPath: flags.kgPath ?? '.hev-ask/kg.json',
      inputPath: flags.input ?? '.hev-ask/kg-distill.json',
      kgContentGlobs: flags.kgContentGlobs.length ? flags.kgContentGlobs : undefined,
      chunkHeadingDepth: flags.chunkHeadingDepth ?? 3,
    });
    console.log(`[hev-ask] kg:${result.status} ${result.path} (${result.chunks} chunks)`);
  } else if (command === 'verify') {
    const result = await verifyAnchors({
      siteRoot: process.cwd(),
      collections: flags.collections.length ? flags.collections : ['docs'],
      basePath: flags.basePath ?? '/docs/',
      kgPath: flags.kgPath ?? '.hev-ask/kg.json',
      kgContentGlobs: flags.kgContentGlobs.length ? flags.kgContentGlobs : undefined,
      chunkHeadingDepth: flags.chunkHeadingDepth ?? 3,
      buildCommand: flags.buildCommand,
      skipBuild: flags.skipBuild,
    });

    let failed = false;

    // Anchor drift is always fatal — it is fully deterministic and keyless.
    if (result.missing.length) {
      for (const miss of result.missing) {
        console.error(`[hev-ask] missing anchor ${miss.anchorId} for ${miss.url} in ${miss.file}`);
      }
      failed = true;
    }

    // Coverage + literal-fidelity warn by default; --strict makes them fatal.
    if (result.uncovered.length) {
      const sample = result.uncovered.slice(0, 5).join(', ');
      const more = result.uncovered.length > 5 ? `, …(+${result.uncovered.length - 5})` : '';
      console.warn(`[hev-ask] ${result.uncovered.length} section(s) missing from the graph: ${sample}${more} — run \`hev-ask-kg build\`.`);
      if (flags.strict) failed = true;
    }
    if (result.dropped.length) {
      console.warn(`[hev-ask] ${result.dropped.length} source literal(s) dropped from agent-primary nodes — run \`hev-ask-kg build\`:`);
      for (const drop of result.dropped.slice(0, 8)) console.warn(`  - ${drop.id}: ${drop.literal}`);
      if (flags.strict) failed = true;
    }

    if (failed) {
      process.exitCode = 1;
    } else {
      const warnings = result.dropped.length || result.uncovered.length ? ' (with warnings)' : '';
      console.log(`[hev-ask] verified ${result.checked} anchors${warnings}`);
    }
  } else {
    console.error(
      'Usage: hev-ask-kg build|corpus|assemble|verify [--collection docs] [--base-path /docs/] [--out path] [--input path] [--strict]',
    );
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`[hev-ask] ${(err as Error).message}`);
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
    } else if (arg === '--out' && next) {
      flags.out = next;
      i += 1;
    } else if (arg === '--input' && next) {
      flags.input = next;
      i += 1;
    } else if (arg === '--skip-build') {
      flags.skipBuild = true;
    } else if (arg === '--strict') {
      flags.strict = true;
    }
  }
  return flags;
}
