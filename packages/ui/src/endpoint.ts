import type { APIRoute } from 'astro';
import config from 'virtual:hev-ask/config';
import digest from 'virtual:hev-ask/digest';
import {
  decodePathValue,
  getGlossaryEntry,
  getOverview,
  getSection,
  listGlossary,
  listSectionSummaries,
} from './digest/read.ts';
import { digestTreeFiles } from './digest/tree.ts';
import { makeTelemetry, telemetryFromEnv } from './observability';
import { PROVIDERS, clientFor, resolveProviderName } from './providers';
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

// Merge the runtime environments the endpoint may run under: Cloudflare's
// per-request `locals.runtime.env` wins over `process.env` (Node adapters),
// which wins over build-time `import.meta.env`.
function resolveEnv(locals: unknown): Record<string, string | undefined> {
  const fromRuntime = (locals as { runtime?: { env?: Record<string, string> } })?.runtime?.env ?? {};
  const fromProcess = (typeof process !== 'undefined' ? process.env : undefined) ?? {};
  const fromImportMeta = (import.meta as { env?: Record<string, string> }).env ?? {};
  return { ...fromImportMeta, ...fromProcess, ...fromRuntime };
}

// `config.provider` is baked at build time; only the key is read per-request.
const provider = resolveProviderName(config.provider);
const providerEnvKey = PROVIDERS[provider].envKey;
const llm = clientFor(provider, config.providerBaseUrl);

function resolveApiKey(locals: unknown): string | undefined {
  return resolveEnv(locals)[providerEnvKey];
}

// PostHog LLM tracing for the answer loop. On Cloudflare, capture promises
// must be handed to `ctx.waitUntil` or they are cancelled when the SSE stream
// closes. No POSTHOG_KEY in the environment → no-op sink.
function resolveTelemetry(locals: unknown) {
  const ctx = (locals as { runtime?: { ctx?: { waitUntil?: (promise: Promise<unknown>) => void } } })
    ?.runtime?.ctx;
  const waitUntil = ctx?.waitUntil ? (promise: Promise<unknown>) => ctx.waitUntil!(promise) : undefined;
  return makeTelemetry(telemetryFromEnv(resolveEnv(locals), { waitUntil, provider }));
}

// The overlay fetches suggested questions from the base route. Sub-routes expose
// keyless reads over the committed digest for CLI, MCP, and generated clients.
export const GET: APIRoute = async ({ params, request }) => {
  const resource = resourceSegments(params.resource);
  if (!resource.length) return json({ suggestions: digest.suggestions ?? [], model: config.model });
  return readResource(resource, request);
};

export const HEAD: APIRoute = ({ params }) => {
  const resource = resourceSegments(params.resource);
  if (resource.length === 1 && decodePathValue(resource[0]).trim() === 'archive') {
    return new Response(null, { status: 200, headers: archiveHeaders() });
  }
  return notFound();
};

export const POST: APIRoute = async ({ request, locals, params }) => {
  if (resourceSegments(params.resource).length) return notFound();

  let query: string | undefined;
  let mode: string | undefined;
  try {
    ({ query, mode } = await request.json());
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }
  if (!query || !query.trim()) return json({ results: [], query: '', model: config.model, mode: 'keyword' });

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
    digest.glossary,
    Math.max(config.maxResults, config.candidatePerSearch),
    config.perDocCap,
    digest.nodes,
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
      warning: `AI search is unavailable because ${providerEnvKey} is not configured.`,
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
          digest,
          telemetry: resolveTelemetry(locals),
          call: llm.call,
          stream: llm.stream,
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

async function readResource(resource: string[], request: Request): Promise<Response> {
  const [rawRoot, ...rest] = resource;
  const root = decodePathValue(rawRoot).trim();

  if (root === 'archive' && rest.length === 0) return archiveResponse();

  if (root === 'glossary') {
    if (!rest.length) return json({ terms: listGlossary(digest) });
    const entry = getGlossaryEntry(digest, rest.join('/'));
    return entry ? json(entry) : notFound('No glossary entry matched that term or alias.');
  }

  if (root === 'sections') {
    if (!rest.length) {
      const group = new URL(request.url).searchParams.get('group');
      return json({ sections: listSectionSummaries(digest, group) });
    }
    const node = getSection(digest, rest.join('/'));
    return node ? json(node) : notFound('No section matched that id.');
  }

  if (root === 'overview' && rest.length === 0) return json(getOverview(digest));

  return notFound();
}

async function archiveResponse(): Promise<Response> {
  const tar = writeTar(digestTreeFiles(digest));
  const body = await gzip(tar);
  return new Response(arrayBufferFor(body), { status: 200, headers: archiveHeaders() });
}

function archiveHeaders(): HeadersInit {
  return {
    'content-type': 'application/gzip',
    'content-disposition': 'attachment; filename="hev-ask-digest.tar.gz"',
    'cache-control': 'public, max-age=60',
    'x-hev-ask-content-hash': digest.contentHash ?? '',
  };
}

interface ArchiveFile {
  path: string;
  body: string;
}

function writeTar(files: ArchiveFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  for (const file of files) {
    const body = encoder.encode(file.body);
    chunks.push(tarHeader(file.path, body.length));
    chunks.push(body);
    const padding = (512 - (body.length % 512)) % 512;
    if (padding) chunks.push(new Uint8Array(padding));
  }
  chunks.push(new Uint8Array(1024));
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function tarHeader(filePath: string, size: number): Uint8Array {
  const header = new Uint8Array(512);
  const { name, prefix } = tarNameParts(filePath);
  writeAscii(header, 0, 100, name);
  writeOctal(header, 100, 8, 0o644);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = '0'.charCodeAt(0);
  writeAscii(header, 257, 6, 'ustar');
  writeAscii(header, 263, 2, '00');
  writeAscii(header, 345, 155, prefix);
  let checksum = 0;
  for (const byte of header) checksum += byte;
  writeOctal(header, 148, 8, checksum);
  return header;
}

function tarNameParts(filePath: string): { name: string; prefix: string } {
  const normalized = filePath.replace(/^\/+/, '');
  if (normalized.length <= 100) return { name: normalized, prefix: '' };
  const minNameStart = Math.max(0, normalized.length - 100);
  for (let i = minNameStart; i >= 0; i -= 1) {
    if (normalized[i] !== '/') continue;
    const prefix = normalized.slice(0, i);
    const name = normalized.slice(i + 1);
    if (prefix.length <= 155 && name.length <= 100) return { name, prefix };
  }
  throw new Error(`Digest archive path is too long for ustar: ${filePath}`);
}

function writeAscii(target: Uint8Array, offset: number, length: number, value: string): void {
  const bytes = new TextEncoder().encode(value);
  target.set(bytes.slice(0, length), offset);
}

function writeOctal(target: Uint8Array, offset: number, length: number, value: number): void {
  const text = value.toString(8).padStart(length - 1, '0').slice(-(length - 1));
  writeAscii(target, offset, length, text);
}

async function gzip(data: Uint8Array): Promise<Uint8Array> {
  const Compression = (globalThis as { CompressionStream?: new (format: 'gzip') => TransformStream<Uint8Array, Uint8Array> }).CompressionStream;
  if (!Compression) throw new Error('CompressionStream is unavailable in this runtime.');
  const stream = new Blob([arrayBufferFor(data)]).stream().pipeThrough(new Compression('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function arrayBufferFor(data: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy.buffer;
}

function resourceSegments(value: string | undefined): string[] {
  return (value ?? '')
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

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
  if (staleWarningIssued || !digest.contentHash || typeof crypto === 'undefined' || !crypto.subtle) return;
  staleWarningIssued = true;
  const hash = await sha256Hex(hashableChunkText(chunks)).catch(() => '');
  if (hash && hash !== digest.contentHash) {
    console.warn('[hev-ask] Digest content hash is stale; run `ask digest build` to refresh it.');
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

function notFound(error = 'Not found.'): Response {
  return json({ error }, 404);
}
