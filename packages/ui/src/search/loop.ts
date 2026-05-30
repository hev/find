import {
  callClaude,
  streamClaude,
  type AnthropicMessage,
  type AnthropicResponse,
  type AnthropicTextBlock,
  type AnthropicTool,
  type AnthropicToolResultBlock,
} from '../llm.ts';
import type { KnowledgeGraph } from '../kg/schema';
import type { Source } from '../components/markdown.ts';
import type { Chunk } from './chunk';
import { prefilter, type Candidate } from './prefilter.ts';

export interface SearchLoopConfig {
  model: string;
  maxIterations: number;
  candidatePerSearch: number;
  perDocCap: number;
  maxResults: number;
  answerMaxTokens: number;
}

export type { Source };

/** High-level events the endpoint forwards to the SSE stream. */
export type AgenticEvent =
  | { type: 'search'; query: string }
  | { type: 'sources'; sources: Source[] }
  | { type: 'token'; text: string }
  | { type: 'done' };

export type CallClaude = typeof callClaude;
export type StreamClaude = typeof streamClaude;

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

/**
 * Runs the bounded search-tool loop, then streams a grounded answer.
 *
 * Intermediate search turns are non-streaming (they are tool-use turns whose
 * blocks must be fully reconstructed before searches run). The final answer
 * turn is streamed with *no tools* so the model can only emit answer text —
 * which sidesteps the "stream tokens but retract them if the model searches
 * again" problem entirely.
 */
export async function* runAgenticAnswerLoop({
  apiKey,
  query,
  chunks,
  kg,
  config,
  signal,
  call = callClaude,
  stream = streamClaude,
}: {
  apiKey: string;
  query: string;
  chunks: Chunk[];
  kg: KnowledgeGraph;
  config: SearchLoopConfig;
  signal?: AbortSignal;
  call?: CallClaude;
  stream?: StreamClaude;
}): AsyncGenerator<AgenticEvent> {
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const seen = new Map<string, SeenCandidate>();
  const messages: AnthropicMessage[] = [{ role: 'user', content: `Query: ${query}` }];
  const system = buildSystemPrompt(config, kg);

  // Phase 1: bounded, non-streaming search loop.
  for (let i = 0; i < config.maxIterations; i += 1) {
    const response = await call({
      apiKey,
      model: config.model,
      system,
      messages,
      tools: [SEARCH_TOOL],
      toolChoice: { type: 'auto' },
      maxTokens: 1024,
      signal,
    });

    messages.push({ role: 'assistant', content: response.content });
    const toolResults: AnthropicToolResultBlock[] = [];

    for (const block of response.content) {
      if (block.type !== 'tool_use' || block.name !== 'search') continue;
      const searchQuery = normalizeToolQuery(block.input) || query;
      yield { type: 'search', query: searchQuery };
      const fresh = runSearchTool(searchQuery, chunks, byId, seen, kg, config);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(fresh.map((candidate) => candidateForToolResult(candidate, byId))),
      });
    }

    // No search this turn → the model is ready to answer.
    if (!toolResults.length) break;
    messages.push({ role: 'user', content: toolResults });
  }

  // Fallback: ground the answer even if the model never searched.
  if (!seen.size) {
    const fresh = runSearchTool(query, chunks, byId, seen, kg, config);
    yield { type: 'search', query };
    messages.push({
      role: 'user',
      content: `Search results:\n${JSON.stringify(fresh.map((candidate) => candidateForToolResult(candidate, byId)))}`,
    });
  }

  const sources = sourcesFromSeen(seen, config.maxResults);
  yield { type: 'sources', sources };

  // Phase 2: streamed answer turn — no tools, so the model can only answer.
  for await (const event of stream({
    apiKey,
    model: config.model,
    system: answerSystem(system, sources),
    messages,
    maxTokens: config.answerMaxTokens,
    signal,
  })) {
    if (event.type === 'text' && event.text) yield { type: 'token', text: event.text };
  }

  yield { type: 'done' };
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

function candidateForToolResult(candidate: Candidate, byId: Map<string, Chunk>) {
  return {
    id: candidate.id,
    docTitle: candidate.docTitle,
    heading: candidate.heading,
    url: byId.get(candidate.id)?.url ?? '',
    snippet: candidate.snippet,
  };
}

function buildSystemPrompt(config: SearchLoopConfig, kg: KnowledgeGraph): AnthropicTextBlock[] {
  return [
    {
      type: 'text',
      text: `You are the documentation assistant for this site. Answer the user's question using ONLY the documentation sections returned by the search tool.

You decide how many searches to run, up to ${config.maxIterations}. Issue focused sub-queries with the search tool: vary terms, try synonyms, and decompose multi-part questions. When you have gathered enough context, stop calling the search tool and write your answer.

Write a concise, helpful answer in Markdown:
- Ground every claim in the retrieved sections.
- When you reference a section, link to it inline using its exact \`url\` from the search results, for example: [autoscaling](/docs/concepts#kubernetes-autoscaling). Never invent a URL or anchor — only link to URLs that appear in the search results.
- If the documentation does not cover the question, say so plainly and do not fabricate an answer.
- Be direct: no preamble, no meta-commentary, no "based on the documentation" filler.`,
    },
    {
      type: 'text',
      text: `<domain_context>\n${kg.context || 'No knowledge graph context is available.'}\n</domain_context>`,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

/** Appends the grounding allow-list to the system prompt for the answer turn. */
function answerSystem(system: AnthropicTextBlock[], sources: Source[]): AnthropicTextBlock[] {
  if (!sources.length) return system;
  const list = sources.map((source) => `- ${source.url} (${source.heading ?? source.title})`).join('\n');
  return [
    ...system,
    {
      type: 'text',
      text: `You have finished searching. Write the answer now. Use only these URLs when linking:\n${list}`,
    },
  ];
}

function sourcesFromSeen(seen: Map<string, SeenCandidate>, maxResults: number): Source[] {
  const sources: Source[] = [];
  const urls = new Set<string>();
  for (const { chunk } of seen.values()) {
    if (urls.has(chunk.url)) continue;
    urls.add(chunk.url);
    sources.push({ title: chunk.docTitle, heading: chunk.heading, url: chunk.url, group: chunk.group });
    if (sources.length >= maxResults) break;
  }
  return sources;
}

function normalizeToolQuery(input: unknown): string {
  return typeof (input as { query?: unknown })?.query === 'string' ? (input as { query: string }).query.trim() : '';
}

export function toolUse(id: string, name: string, input: unknown): AnthropicResponse['content'][number] {
  return { type: 'tool_use', id, name, input };
}
