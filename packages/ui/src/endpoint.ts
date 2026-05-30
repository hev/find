import type { APIRoute } from 'astro';
import config from 'virtual:hev-find/config';
import kg from 'virtual:hev-find/kg';
import { hashableChunkText } from './search/chunk';
import { buildIndex, prefilter, type Candidate, type Chunk } from './search/index';
import { runAgenticSearchLoop, type SearchResult } from './search/loop';

export const prerender = false;

let indexPromise: Promise<Chunk[]> | null = null;
let staleWarningIssued = false;

function getIndex(): Promise<Chunk[]> {
  if (!indexPromise) indexPromise = buildIndex(config.collections, config.basePath, config.chunkHeadingDepth);
  return indexPromise;
}

function resolveApiKey(locals: unknown): string | undefined {
  const fromRuntime = (locals as { runtime?: { env?: Record<string, string> } })?.runtime?.env
    ?.ANTHROPIC_API_KEY;
  const fromProcess = typeof process !== 'undefined' ? process.env?.ANTHROPIC_API_KEY : undefined;
  const fromImportMeta = (import.meta as { env?: Record<string, string> }).env?.ANTHROPIC_API_KEY;
  return fromRuntime ?? fromProcess ?? fromImportMeta;
}

export const POST: APIRoute = async ({ request, locals }) => {
  let query: string | undefined;
  let mode: string | undefined;
  try {
    ({ query, mode } = await request.json());
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  if (!query || !query.trim()) return json({ results: [], query: '', model: config.model });

  let chunks: Chunk[];
  try {
    chunks = await getIndex();
    void warnIfStale(chunks);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }

  const keywordCandidates = prefilter(
    chunks,
    query,
    kg.glossary,
    Math.max(config.maxResults, config.candidatePerSearch),
    config.perDocCap,
  );

  const apiKey = resolveApiKey(locals);
  const keywordResults = () =>
    toResults(keywordCandidates, new Map(chunks.map((chunk) => [chunk.id, chunk])), config.maxResults);

  if (mode === 'agentic' && !apiKey) {
    return json({
      results: keywordResults(),
      query,
      model: config.model,
      mode: 'keyword',
      warning: 'AI search is unavailable because ANTHROPIC_API_KEY is not configured.',
    });
  }

  if (mode === 'keyword' || !apiKey) {
    return json({
      results: keywordResults(),
      query,
      model: config.model,
      mode: 'keyword',
    });
  }

  let loop;
  try {
    loop = await runAgenticSearchLoop({
      apiKey,
      query,
      chunks,
      kg,
      config: {
        model: config.model,
        maxIterations: config.maxIterations,
        candidatePerSearch: config.candidatePerSearch,
        perDocCap: config.perDocCap,
        maxResults: config.maxResults,
      },
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }

  return json({
    results: loop.results,
    searches: loop.searches,
    query,
    model: config.model,
    mode: 'agentic',
  });
};

function toResults(candidates: Candidate[], byId: Map<string, Chunk>, maxResults: number): SearchResult[] {
  return candidates
    .map((candidate) => {
      const chunk = byId.get(candidate.id);
      return chunk ? chunkToResult(chunk, candidate.snippet) : null;
    })
    .filter((result): result is SearchResult => result !== null)
    .slice(0, maxResults);
}

function chunkToResult(chunk: Chunk, snippet: string): SearchResult {
  return {
    title: chunk.docTitle,
    heading: chunk.heading,
    url: chunk.url,
    group: chunk.group,
    snippet,
  };
}

async function warnIfStale(chunks: Chunk[]) {
  if (staleWarningIssued || !kg.contentHash || typeof crypto === 'undefined' || !crypto.subtle) return;
  staleWarningIssued = true;
  const hash = await sha256Hex(hashableChunkText(chunks)).catch(() => '');
  if (hash && hash !== kg.contentHash) {
    console.warn('[hev-find] Knowledge graph content hash is stale; run `hev-find-kg build` to refresh it.');
  }
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
