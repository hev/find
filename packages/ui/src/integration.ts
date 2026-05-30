import type { AstroIntegration } from 'astro';
import type { AgenticSearchOptions, ResolvedConfig } from './types';

const VIRTUAL_ID = 'virtual:agentic-search/config';

/**
 * Astro integration that mounts an on-demand agentic search endpoint and
 * exposes its resolved configuration to that endpoint via a virtual module.
 *
 * Pair it with the `SearchOverlay.astro` component for the ⌘K UI.
 */
export default function agenticSearch(options: AgenticSearchOptions = {}): AstroIntegration {
  const config: ResolvedConfig = {
    collections: options.collections ?? null,
    model: options.model ?? 'claude-haiku-4-5',
    endpoint: options.endpoint ?? '/api/agentic-search',
    basePath: options.basePath ?? '/docs/',
    maxResults: options.maxResults ?? 6,
    candidatePool: options.candidatePool ?? 12,
  };

  return {
    name: '@hev/astro-agentic-search',
    hooks: {
      'astro:config:setup': ({ injectRoute, updateConfig, logger }) => {
        updateConfig({
          vite: { plugins: [virtualConfigPlugin(config)] },
        });

        injectRoute({
          pattern: config.endpoint,
          entrypoint: '@hev/astro-agentic-search/endpoint',
          prerender: false,
        });

        if (!config.collections?.length) {
          logger.warn(
            'No `collections` configured — search will error until you set e.g. collections: ["docs"].',
          );
        }
        logger.info(`search endpoint at ${config.endpoint} (model: ${config.model})`);
      },
    },
  };
}

/** Serializes the resolved config into a virtual module the endpoint imports. */
function virtualConfigPlugin(config: ResolvedConfig) {
  const resolvedId = '\0' + VIRTUAL_ID;
  return {
    name: 'agentic-search:config',
    resolveId(id: string) {
      return id === VIRTUAL_ID ? resolvedId : undefined;
    },
    load(id: string) {
      return id === resolvedId ? `export default ${JSON.stringify(config)};` : undefined;
    },
  };
}
