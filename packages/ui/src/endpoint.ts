import type { APIRoute } from 'astro';
import config from 'virtual:hev-ask/config';
import kg from 'virtual:hev-ask/kg';
import { hashableChunkText } from './search/chunk';
import { buildIndex, prefilter, type Candidate, type Chunk } from './search/index';
import { runAgenticAnswerLoop, type AgenticEvent } from './search/loop';

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

// The overlay fetches the suggested questions on first open. They are baked into
// the committed graph, so this is a cheap, keyless JSON response — no model call.
export const GET: APIRoute = () => json({ suggestions: kg.suggestions ?? [], model: config.model });

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
    kg.nodes,
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      try {
        for await (const ev of runAgenticAnswerLoop({
          apiKey,
          query: query as string,
          chunks,
          kg,
          config: {
            model: config.model,
            maxIterations: config.maxIterations,
            candidatePerSearch: config.candidatePerSearch,
            perDocCap: config.perDocCap,
            maxResults: config.maxResults,
            answerMaxTokens: config.answerMaxTokens,
          },
          signal: request.signal,
        })) {
          if (request.signal.aborted) break;
          forward(send, ev, config.model);
        }
      } catch (err) {
        // The HTTP status is already committed once streaming starts, so surface
        // failures as an SSE error event rather than a status change.
        send('error', { error: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
};

function forward(send: (event: string, data: unknown) => void, ev: AgenticEvent, model: string): void {
  if (ev.type === 'sources') send('sources', { sources: ev.sources, model, mode: 'agentic' });
  else if (ev.type === 'token') send('token', { text: ev.text });
  else if (ev.type === 'search') send('search', { query: ev.query });
  else if (ev.type === 'done') send('done', {});
}

interface KeywordResult {
  title: string;
  heading?: string;
  url: string;
  group?: string;
  snippet: string;
}

function toResults(candidates: Candidate[], byId: Map<string, Chunk>, maxResults: number): KeywordResult[] {
  return candidates
    .map((candidate) => {
      const chunk = byId.get(candidate.id);
      return chunk ? chunkToResult(chunk, candidate.snippet) : null;
    })
    .filter((result): result is KeywordResult => result !== null)
    .slice(0, maxResults);
}

function chunkToResult(chunk: Chunk, snippet: string): KeywordResult {
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
    console.warn('[hev-ask] Knowledge graph content hash is stale; run `hev-ask-kg build` to refresh it.');
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
