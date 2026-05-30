import type { APIRoute } from 'astro';
import config from 'virtual:agentic-search/config';
import { buildIndex, prefilter, type IndexEntry } from './search/index';
import { callClaude, type AnthropicTool } from './llm';

export const prerender = false;

// Build the index once per server process, on first request.
let indexPromise: Promise<IndexEntry[]> | null = null;
function getIndex(): Promise<IndexEntry[]> {
  if (!indexPromise) indexPromise = buildIndex(config.collections, config.basePath);
  return indexPromise;
}

const SYSTEM = `You generate search results for a documentation site.

You are given a user's query and a list of candidate documents. Select the documents that genuinely match the query, order them best-match first, and for each write ONE concise sentence (max ~140 characters) describing what the reader will find there and why it matches.

You are a search-results generator, NOT a chat assistant:
- Never answer the question directly.
- Never address the user or add commentary, preamble, or follow-ups.
- Only call the present_results tool.
- Omit candidates that are not relevant. If none are relevant, return an empty list.`;

const RESULTS_TOOL: AnthropicTool = {
  name: 'present_results',
  description: 'Return the ranked list of search results to display in the overlay.',
  input_schema: {
    type: 'object',
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'The id of one of the candidate documents.' },
            snippet: {
              type: 'string',
              description:
                'One concise sentence (max ~140 chars) on what this document covers and why it matches the query.',
            },
          },
          required: ['id', 'snippet'],
        },
      },
    },
    required: ['results'],
  },
};

interface PickedResult {
  id: string;
  snippet: string;
}

/**
 * Resolve the API key across runtimes: Cloudflare/Workers expose env via
 * `locals.runtime.env`, Node via `process.env`, and Astro dev via
 * `import.meta.env`.
 */
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

  let index: IndexEntry[];
  try {
    index = await getIndex();
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }

  const candidates = prefilter(index, query, config.candidatePool);
  // Map ids back to real entries server-side so URLs/titles can't be hallucinated.
  const byId = new Map(index.map((e) => [e.id, e]));

  // Keyword mode ("typical search"): return the prefiltered matches directly,
  // using the body excerpt as the preview. No model call, no API key needed.
  if (mode === 'keyword') {
    const results = candidates
      .map((c) => {
        const entry = byId.get(c.id);
        return entry ? { title: entry.title, url: entry.url, group: entry.group, snippet: c.snippet } : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .slice(0, config.maxResults);
    return json({ results, query, model: config.model, mode: 'keyword' });
  }

  if (candidates.length === 0) return json({ results: [], query, model: config.model, mode: 'agentic' });

  const apiKey = resolveApiKey(locals);
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY is not set on the server.' }, 500);

  const candidateText = candidates
    .map(
      (c) =>
        `id: ${c.id}\ntitle: ${c.title}${c.group ? `\nsection: ${c.group}` : ''}\nexcerpt: ${c.snippet}`,
    )
    .join('\n\n');

  const userMessage = `Query: ${query}\n\nCandidate documents:\n\n${candidateText}\n\nReturn up to ${config.maxResults} results, best match first.`;

  let response;
  try {
    response = await callClaude({
      apiKey,
      model: config.model,
      system: SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
      tools: [RESULTS_TOOL],
      toolChoice: { type: 'tool', name: 'present_results' },
      maxTokens: 1024,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 502);
  }

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  const picked = ((toolUse?.type === 'tool_use' && (toolUse.input as { results?: PickedResult[] })?.results) ||
    []) as PickedResult[];

  const results = picked
    .map((p) => {
      const entry = byId.get(p.id);
      if (!entry) return null;
      return { title: entry.title, url: entry.url, group: entry.group, snippet: p.snippet };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .slice(0, config.maxResults);

  return json({ results, query, model: config.model, mode: 'agentic' });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
