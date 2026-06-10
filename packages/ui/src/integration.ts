import type { AstroIntegration } from 'astro';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { readDigestArtifact } from './digest/tree';
import { PROVIDERS, resolveProviderName } from './providers';
import type { HevAskOptions, ResolvedConfig } from './types';

const CONFIG_VIRTUAL_ID = 'virtual:hev-ask/config';
const DIGEST_VIRTUAL_ID = 'virtual:hev-ask/digest';
const execFileAsync = promisify(execFile);

/**
 * Astro integration that mounts the hev ask endpoint and exposes resolved
 * configuration plus the committed ask digest through virtual modules.
 */
export default function hevAsk(options: HevAskOptions = {}): AstroIntegration {
  const provider = resolveProviderName(options.provider);
  const config: ResolvedConfig = {
    collections: options.collections ?? null,
    provider,
    providerBaseUrl: options.providerBaseUrl,
    model: options.model ?? PROVIDERS[provider].defaultModel,
    digestModel: options.digestModel ?? PROVIDERS[provider].defaultDigestModel,
    endpoint: options.endpoint ?? '/api/ask',
    basePath: options.basePath ?? '/docs/',
    maxResults: options.maxResults ?? 6,
    answerMaxTokens: options.answerMaxTokens ?? 1024,
    maxIterations: options.maxIterations ?? 4,
    chunkHeadingDepth: options.chunkHeadingDepth ?? 3,
    candidatePerSearch: options.candidatePerSearch ?? 8,
    perDocCap: options.perDocCap ?? 2,
    digestPath: options.digestDir ?? options.digestPath ?? '.hev-ask',
    digestContentGlobs: options.digestContentGlobs,
  };

  let siteRoot = process.cwd();

  return {
    name: '@hevmind/ask',
    hooks: {
      'astro:config:setup': ({ config: astroConfig, injectRoute, updateConfig, logger, addWatchFile }) => {
        siteRoot = fileURLToPath(astroConfig.root);
        updateConfig({
          vite: { plugins: [virtualConfigPlugin(config), virtualDigestPlugin(config, siteRoot)] },
        });

        injectRoute({
          pattern: resourceRoutePattern(config.endpoint),
          entrypoint: '@hevmind/ask/endpoint',
          prerender: false,
        });

        addWatchFile(new URL(config.digestPath, astroConfig.root));

        if (!config.collections?.length) {
          logger.warn('No `collections` configured; search will error until you set e.g. collections: ["docs"].');
        }
        logger.info(`search endpoint at ${config.endpoint} (model: ${config.model})`);
      },
      'astro:build:start': async ({ logger }) => {
        if (!config.collections?.length) return;
        const envKey = PROVIDERS[config.provider].envKey;
        const apiKey = process.env[envKey];
        if (!apiKey) {
          logger.warn(`${envKey} is not set; using committed ${config.digestPath} if present.`);
          return;
        }

        try {
          const output = await runDigestBuild(siteRoot, config);
          if (output) logger.info(output);
        } catch (err) {
          logger.warn(`digest build failed; using committed artifact if present. ${(err as Error).message}`);
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

function virtualDigestPlugin(config: ResolvedConfig, siteRoot: string) {
  const resolvedId = '\0' + DIGEST_VIRTUAL_ID;
  return {
    name: 'hev-ask:digest',
    resolveId(id: string) {
      return id === DIGEST_VIRTUAL_ID ? resolvedId : undefined;
    },
    load(id: string) {
      if (id !== resolvedId) return undefined;
      const digest = readDigest(siteRoot, config.digestPath);
      return `export default ${JSON.stringify(digest)};`;
    },
  };
}

function readDigest(siteRoot: string, digestPath: string) {
  return readDigestArtifact(siteRoot, digestPath);
}

async function runDigestBuild(siteRoot: string, config: ResolvedConfig): Promise<string> {
  const askBin = fileURLToPath(new URL('../bin/ask.mjs', import.meta.url));
  const args = [
    askBin,
    'digest',
    'build',
    '--digest-dir',
    config.digestPath,
    '--base-path',
    config.basePath,
    '--chunk-heading-depth',
    String(config.chunkHeadingDepth),
    '--digest-model',
    config.digestModel,
    '--provider',
    config.provider,
  ];
  if (config.providerBaseUrl) args.push('--provider-url', config.providerBaseUrl);
  for (const collection of config.collections ?? []) args.push('--collection', collection);
  for (const glob of config.digestContentGlobs ?? []) args.push('--content-glob', glob);

  const { stdout, stderr } = await execFileAsync(process.execPath, args, {
    cwd: siteRoot,
    env: process.env,
    maxBuffer: 1024 * 1024 * 8,
  });
  const output = [stdout, stderr].map((value) => value.trim()).filter(Boolean).join('\n');
  return output.replace(/^\[hev-ask\]\s*/gm, '');
}

function resourceRoutePattern(endpoint: string): string {
  if (endpoint === '/') return '/[...resource]';
  const base = endpoint.endsWith('/') && endpoint.length > 1 ? endpoint.slice(0, -1) : endpoint;
  return `${base}/[...resource]`;
}
