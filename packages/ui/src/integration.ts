import type { AstroIntegration } from 'astro';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildKnowledgeGraph } from './kg/build';
import { EMPTY_KG, normalizeKnowledgeGraph } from './kg/schema';
import type { HevAskOptions, ResolvedConfig } from './types';

const CONFIG_VIRTUAL_ID = 'virtual:hev-ask/config';
const KG_VIRTUAL_ID = 'virtual:hev-ask/kg';

/**
 * Astro integration that mounts the hev ask endpoint and exposes resolved
 * configuration plus the committed knowledge graph through virtual modules.
 */
export default function hevAsk(options: HevAskOptions = {}): AstroIntegration {
  const config: ResolvedConfig = {
    collections: options.collections ?? null,
    model: options.model ?? 'claude-haiku-4-5',
    kgModel: options.kgModel ?? 'claude-opus-4-8',
    endpoint: options.endpoint ?? '/api/ask',
    basePath: options.basePath ?? '/docs/',
    maxResults: options.maxResults ?? 6,
    answerMaxTokens: options.answerMaxTokens ?? 1024,
    maxIterations: options.maxIterations ?? 4,
    chunkHeadingDepth: options.chunkHeadingDepth ?? 3,
    candidatePerSearch: options.candidatePerSearch ?? 8,
    perDocCap: options.perDocCap ?? 2,
    kgPath: options.kgPath ?? '.hev-ask/kg.json',
    kgContentGlobs: options.kgContentGlobs,
  };

  let siteRoot = process.cwd();

  return {
    name: '@hev/ask',
    hooks: {
      'astro:config:setup': ({ config: astroConfig, injectRoute, updateConfig, logger, addWatchFile }) => {
        siteRoot = fileURLToPath(astroConfig.root);
        updateConfig({
          vite: { plugins: [virtualConfigPlugin(config), virtualKgPlugin(config, siteRoot)] },
        });

        injectRoute({
          pattern: config.endpoint,
          entrypoint: '@hev/ask/endpoint',
          prerender: false,
        });

        addWatchFile(new URL(config.kgPath, astroConfig.root));

        if (!config.collections?.length) {
          logger.warn('No `collections` configured; search will error until you set e.g. collections: ["docs"].');
        }
        logger.info(`search endpoint at ${config.endpoint} (model: ${config.model})`);
      },
      'astro:build:start': async ({ logger }) => {
        if (!config.collections?.length) return;
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          logger.warn(`ANTHROPIC_API_KEY is not set; using committed ${config.kgPath} if present.`);
          return;
        }

        try {
          const result = await buildKnowledgeGraph({
            siteRoot,
            collections: config.collections,
            basePath: config.basePath,
            kgPath: config.kgPath,
            kgContentGlobs: config.kgContentGlobs,
            chunkHeadingDepth: config.chunkHeadingDepth,
            kgModel: config.kgModel,
            apiKey,
          });
          logger.info(`knowledge graph ${result.status} (${result.chunks} chunks)`);
        } catch (err) {
          logger.warn(`knowledge graph build failed; using committed artifact if present. ${(err as Error).message}`);
        }
      },
    },
  };
}

/** Serializes the resolved config into a virtual module the endpoint imports. */
function virtualConfigPlugin(config: ResolvedConfig) {
  const resolvedId = '\0' + CONFIG_VIRTUAL_ID;
  return {
    name: 'hev-ask:config',
    resolveId(id: string) {
      return id === CONFIG_VIRTUAL_ID ? resolvedId : undefined;
    },
    load(id: string) {
      return id === resolvedId ? `export default ${JSON.stringify(config)};` : undefined;
    },
  };
}

function virtualKgPlugin(config: ResolvedConfig, siteRoot: string) {
  const resolvedId = '\0' + KG_VIRTUAL_ID;
  return {
    name: 'hev-ask:kg',
    resolveId(id: string) {
      return id === KG_VIRTUAL_ID ? resolvedId : undefined;
    },
    load(id: string) {
      if (id !== resolvedId) return undefined;
      const kg = readKnowledgeGraph(siteRoot, config.kgPath);
      return `export default ${JSON.stringify(kg)};`;
    },
  };
}

function readKnowledgeGraph(siteRoot: string, kgPath: string) {
  try {
    return normalizeKnowledgeGraph(JSON.parse(readFileSync(path.resolve(siteRoot, kgPath), 'utf8')));
  } catch {
    return EMPTY_KG;
  }
}
