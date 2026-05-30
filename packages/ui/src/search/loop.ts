import { callClaude, type AnthropicMessage, type AnthropicResponse, type AnthropicTool, type AnthropicToolResultBlock } from '../llm.ts';
import type { KnowledgeGraph } from '../kg/schema';
import type { Chunk } from './chunk';
import { prefilter, type Candidate } from './prefilter.ts';

export interface SearchLoopConfig {
  model: string;
  maxIterations: number;
  candidatePerSearch: number;
  perDocCap: number;
  maxResults: number;
}

export interface SearchResult {
  title: string;
  heading?: string;
  url: string;
  group?: string;
  snippet: string;
}

export interface SearchLoopResult {
  results: SearchResult[];
  searches: string[];
}

export type CallClaude = typeof callClaude;

interface PickedResult {
  id: string;
  snippet: string;
}

interface SeenCandidate {
  chunk: Chunk;
  snippet: string;
}

const SEARCH_TOOL: AnthropicTool = {
  name: 'search',
  description: 'Search the documentation heading chunks with a focused sub-query.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Focused keyword query or synonym expansion to search for.' },
    },
    required: ['query'],
  },
};

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
            id: { type: 'string', description: 'The id of a section returned by the search tool.' },
            snippet: {
              type: 'string',
              description:
                'One concise sentence (max ~140 chars) on what this section covers and why it matches the query.',
            },
          },
          required: ['id', 'snippet'],
        },
      },
    },
    required: ['results'],
  },
};

export async function runAgenticSearchLoop({
  apiKey,
  query,
  chunks,
  kg,
  config,
  call = callClaude,
}: {
  apiKey: string;
  query: string;
  chunks: Chunk[];
  kg: KnowledgeGraph;
  config: SearchLoopConfig;
  call?: CallClaude;
}): Promise<SearchLoopResult> {
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const seen = new Map<string, SeenCandidate>();
  const searches: string[] = [];
  const messages: AnthropicMessage[] = [{ role: 'user', content: `Query: ${query}` }];
  const system = buildSystemPrompt(config, kg);
  let picked: PickedResult[] | null = null;

  for (let i = 0; i < config.maxIterations; i += 1) {
    const forcePresent = i === config.maxIterations - 1;
    const response = await call({
      apiKey,
      model: config.model,
      system,
      messages,
      tools: [SEARCH_TOOL, RESULTS_TOOL],
      toolChoice: forcePresent ? { type: 'tool', name: 'present_results' } : { type: 'auto' },
      maxTokens: 2048,
    });

    messages.push({ role: 'assistant', content: response.content });
    const toolResults: AnthropicToolResultBlock[] = [];
    let sawToolUse = false;

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;
      sawToolUse = true;

      if (block.name === 'search') {
        const searchQuery = normalizeToolQuery(block.input) || query;
        const fresh = runSearchTool(searchQuery, chunks, byId, seen, kg, config);
        searches.push(searchQuery);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(fresh.map(candidateForToolResult)),
        });
      } else if (block.name === 'present_results') {
        picked = normalizePicked(block.input);
      }
    }

    if (picked) break;
    if (toolResults.length) {
      messages.push({ role: 'user', content: toolResults });
    } else if (!sawToolUse) {
      break;
    }
  }

  if (!picked) {
    if (!seen.size) {
      const fallback = runSearchTool(query, chunks, byId, seen, kg, config);
      searches.push(query);
      messages.push({
        role: 'user',
        content: `Fallback search candidates:\n${JSON.stringify(fallback.map(candidateForToolResult))}\n\nCall present_results with the best ids from these candidates.`,
      });
    }

    const forced = await call({
      apiKey,
      model: config.model,
      system,
      messages,
      tools: [RESULTS_TOOL],
      toolChoice: { type: 'tool', name: 'present_results' },
      maxTokens: 1024,
    });
    const forcedTool = forced.content.find((block) => block.type === 'tool_use');
    picked = normalizePicked(forcedTool?.type === 'tool_use' ? forcedTool.input : null);
  }

  return { results: pickedToResults(picked, seen, config.maxResults), searches };
}

function runSearchTool(
  searchQuery: string,
  chunks: Chunk[],
  byId: Map<string, Chunk>,
  seen: Map<string, SeenCandidate>,
  kg: KnowledgeGraph,
  config: SearchLoopConfig,
): Candidate[] {
  return prefilter(chunks, searchQuery, kg.glossary, config.candidatePerSearch, config.perDocCap)
    .filter((candidate) => !seen.has(candidate.id))
    .map((candidate) => {
      const chunk = byId.get(candidate.id);
      if (chunk) seen.set(candidate.id, { chunk, snippet: candidate.snippet });
      return candidate;
    })
    .filter((candidate) => byId.has(candidate.id));
}

function candidateForToolResult(candidate: Candidate) {
  return {
    id: candidate.id,
    docTitle: candidate.docTitle,
    heading: candidate.heading,
    snippet: candidate.snippet,
  };
}

function buildSystemPrompt(config: SearchLoopConfig, kg: KnowledgeGraph) {
  return [
    {
      type: 'text' as const,
      text: `You are the search engine for this documentation site. Find the documentation sections that best answer the user's query.

You decide how many searches to run, up to ${config.maxIterations}. Issue focused sub-queries with the search tool: vary terms, try synonyms, and decompose multi-part questions. When you have enough, call present_results with the best sections ordered best-first, each with a one-sentence snippet.

You are a results generator, not a chat assistant:
- Never answer the question directly.
- Never add preamble or commentary.
- Only present ids that were returned by the search tool.`,
    },
    {
      type: 'text' as const,
      text: `<domain_context>\n${kg.context || 'No knowledge graph context is available.'}\n</domain_context>`,
      cache_control: { type: 'ephemeral' as const },
    },
  ];
}

function pickedToResults(picked: PickedResult[], seen: Map<string, SeenCandidate>, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];
  const urls = new Set<string>();
  for (const pick of picked) {
    const candidate = seen.get(pick.id);
    if (!candidate || urls.has(candidate.chunk.url)) continue;
    urls.add(candidate.chunk.url);
    results.push(chunkToResult(candidate.chunk, pick.snippet || candidate.snippet));
    if (results.length >= maxResults) break;
  }
  return results;
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

function normalizeToolQuery(input: unknown): string {
  return typeof (input as { query?: unknown })?.query === 'string' ? (input as { query: string }).query.trim() : '';
}

function normalizePicked(input: unknown): PickedResult[] {
  const results = (input as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];
  return results
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const maybe = item as Partial<PickedResult>;
      if (typeof maybe.id !== 'string') return null;
      return { id: maybe.id, snippet: typeof maybe.snippet === 'string' ? maybe.snippet : '' };
    })
    .filter((item): item is PickedResult => item !== null);
}

export function toolUse(id: string, name: string, input: unknown): AnthropicResponse['content'][number] {
  return { type: 'tool_use', id, name, input };
}
