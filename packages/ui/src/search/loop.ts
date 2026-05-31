import {
  callClaude,
  streamClaude,
  type AnthropicMessage,
  type AnthropicResponse,
  type AnthropicTextBlock,
  type AnthropicTool,
  type AnthropicToolResultBlock,
} from '../llm.ts';
import type { KnowledgeGraph, KnowledgeNode } from '../kg/schema';
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

export interface AnswerLoopArgs {
  apiKey: string;
  query: string;
  chunks: Chunk[];
  kg: KnowledgeGraph;
  config: SearchLoopConfig;
  signal?: AbortSignal;
  call?: CallClaude;
  stream?: StreamClaude;
}

/**
 * Entry point. When the committed knowledge graph carries distilled `nodes`, the
 * agent navigates that shadow graph (graph path). A node-less (v1 / degraded)
 * graph falls back to the original keyword-search loop, unchanged.
 */
export async function* runAgenticAnswerLoop(args: AnswerLoopArgs): AsyncGenerator<AgenticEvent> {
  if (args.kg.nodes && args.kg.nodes.length > 0) {
    yield* graphAnswerLoop(args);
  } else {
    yield* legacyAnswerLoop(args);
  }
}

// ---------------------------------------------------------------------------
// Graph path: navigate the distilled shadow graph and answer from it.
// ---------------------------------------------------------------------------

const OPEN_SECTION_TOOL: AnthropicTool = {
  name: 'open_section',
  description:
    'Open a documentation section by its id (taken from the map) to read its distilled summary, its exact facts (flags, code, identifiers), and — for reference sections — its source text. Open every section you draw your answer from; you may only cite sections you have opened.',
  input_schema: {
    type: 'object',
    properties: {
      id: {
        type: 'string',
        description: 'The exact section id from the map, e.g. "concepts#kubernetes-autoscaling".',
      },
    },
    required: ['id'],
  },
};

async function* graphAnswerLoop({
  apiKey,
  query,
  chunks,
  kg,
  config,
  signal,
  call = callClaude,
  stream = streamClaude,
}: AnswerLoopArgs): AsyncGenerator<AgenticEvent> {
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const nodesById = new Map(kg.nodes.map((node) => [node.id, node]));
  const opened = new Map<string, KnowledgeNode>();
  const messages: AnthropicMessage[] = [{ role: 'user', content: `Query: ${query}` }];
  const system = buildGraphSystemPrompt(kg);

  const open = (id: string): KnowledgeNode | null => {
    const node = nodesById.get(id);
    if (node) opened.set(id, node);
    return node ?? null;
  };

  // Phase 1: bounded loop of section opens (non-streaming tool turns).
  for (let i = 0; i < config.maxIterations; i += 1) {
    const response = await call({
      apiKey,
      model: config.model,
      system,
      messages,
      tools: [OPEN_SECTION_TOOL],
      toolChoice: { type: 'auto' },
      maxTokens: 1024,
      signal,
    });

    messages.push({ role: 'assistant', content: response.content });
    const toolResults: AnthropicToolResultBlock[] = [];

    for (const block of response.content) {
      if (block.type !== 'tool_use' || block.name !== 'open_section') continue;
      const id = normalizeId(block.input);
      const node = open(id);
      if (node) yield { type: 'search', query: node.heading ?? node.title };
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: node
          ? JSON.stringify(openSectionResult(node, byId))
          : JSON.stringify({ error: `No section "${id}". Use an exact id from the map.` }),
      });
    }

    if (!toolResults.length) break; // model is ready to answer
    messages.push({ role: 'user', content: toolResults });
  }

  // Fallback: ground the answer even if the model opened nothing, by opening the
  // best keyword matches over the map.
  if (!opened.size) {
    for (const candidate of prefilter(chunks, query, kg.glossary, config.maxResults, config.perDocCap)) {
      const node = open(candidate.id);
      if (node) yield { type: 'search', query: node.heading ?? node.title };
    }
    if (opened.size && lastRole(messages) !== 'user') {
      const sections = [...opened.values()].map((node) => openSectionResult(node, byId));
      messages.push({ role: 'user', content: `Opened sections:\n${JSON.stringify(sections)}` });
    }
  }

  // The answer turn must start a fresh assistant response. If the loop ended on
  // an assistant turn, nudge with a final user message so it isn't a prefill.
  if (lastRole(messages) === 'assistant') {
    messages.push({
      role: 'user',
      content:
        'Write the answer now. Begin directly with the answer itself — no preamble, no "based on…" opener, no headings. Link only to sections you opened, using their exact url.',
    });
  }

  const sources = sourcesFromNodes(opened, config.maxResults);
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

function openSectionResult(node: KnowledgeNode, byId: Map<string, Chunk>) {
  const base = {
    id: node.id,
    url: node.url,
    heading: node.heading,
    group: node.group,
    mode: node.mode,
    summary: node.summary,
    facts: node.facts.map((fact) => ({ kind: fact.kind, literal: fact.literal })),
  };
  // Reference sections carry dense literals; hand the model the source text so it
  // reads exact wording rather than trusting a paraphrase.
  if (node.mode === 'source-primary') {
    const text = byId.get(node.id)?.text ?? '';
    return { ...base, text: text.length > 1200 ? text.slice(0, 1200) + '…' : text };
  }
  return base;
}

function buildGraphSystemPrompt(kg: KnowledgeGraph): AnthropicTextBlock[] {
  return [
    {
      type: 'text',
      text: `You are the documentation assistant for this site. Answer the user's question using ONLY the documentation sections you open with the open_section tool.

You are given a map of the documentation below: every section, its id, and a short summary. Open the sections you need (open_section), reading their summary and exact facts, then write your answer. You may run up to a few opens. Open every section your answer draws on — you may only link to sections you opened.

Write a short, direct answer in Markdown:
- Start IMMEDIATELY with the substance. Your first sentence must answer the question. Never open with "Based on…", "Here is…", "Sure", a restatement of the question, or any summary/preamble.
- Keep it tight: one or two short paragraphs, plus a short bullet list only if it genuinely helps. This renders in a small search popover, so do NOT use headings (#, ##) or horizontal rules (---).
- For exact strings (flags, commands, identifiers, versions), quote the section's \`facts\` verbatim — never reword them.
- When you reference a section, link to it inline using its exact \`url\`, e.g. [autoscaling](/docs/concepts#kubernetes-autoscaling). Never invent a URL or anchor.
- If the documentation does not cover the question, say so plainly in one sentence and do not fabricate an answer.`,
    },
    {
      type: 'text',
      text: `<map>\n${kg.overview || renderNodeMap(kg.nodes)}\n</map>\n\n<summaries>\n${kg.nodes
        .map((node) => `- \`${node.id}\`${node.mode === 'source-primary' ? ' (reference)' : ''}: ${node.summary}`)
        .join('\n')}\n</summaries>`,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

/** Fallback map when a graph predates the stored `overview`. */
function renderNodeMap(nodes: KnowledgeNode[]): string {
  return nodes.map((node) => `- ${node.heading ?? node.title} — \`${node.id}\``).join('\n');
}

function sourcesFromNodes(opened: Map<string, KnowledgeNode>, maxResults: number): Source[] {
  const sources: Source[] = [];
  const urls = new Set<string>();
  for (const node of opened.values()) {
    if (urls.has(node.url)) continue;
    urls.add(node.url);
    sources.push({
      title: node.title,
      heading: node.heading ?? undefined,
      url: node.url,
      group: node.group ?? undefined,
      terms: node.terms,
    });
    if (sources.length >= maxResults) break;
  }
  return sources;
}

function normalizeId(input: unknown): string {
  return typeof (input as { id?: unknown })?.id === 'string' ? (input as { id: string }).id.trim() : '';
}

// ---------------------------------------------------------------------------
// Legacy path: original keyword-search loop, used for node-less graphs.
// ---------------------------------------------------------------------------

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

async function* legacyAnswerLoop({
  apiKey,
  query,
  chunks,
  kg,
  config,
  signal,
  call = callClaude,
  stream = streamClaude,
}: AnswerLoopArgs): AsyncGenerator<AgenticEvent> {
  const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const seen = new Map<string, SeenCandidate>();
  const messages: AnthropicMessage[] = [{ role: 'user', content: `Query: ${query}` }];
  const system = buildSystemPrompt(kg);

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

    if (!toolResults.length) break;
    messages.push({ role: 'user', content: toolResults });
  }

  if (!seen.size) {
    const fresh = runSearchTool(query, chunks, byId, seen, kg, config);
    yield { type: 'search', query };
    if (lastRole(messages) !== 'user') {
      messages.push({
        role: 'user',
        content: `Search results:\n${JSON.stringify(fresh.map((candidate) => candidateForToolResult(candidate, byId)))}`,
      });
    }
  }

  if (lastRole(messages) === 'assistant') {
    messages.push({
      role: 'user',
      content:
        'Write the answer now. Begin directly with the answer itself — no preamble, no "based on…" opener, no headings. Link only with the provided URLs.',
    });
  }

  const sources = sourcesFromSeen(seen, config.maxResults);
  yield { type: 'sources', sources };

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

function buildSystemPrompt(kg: KnowledgeGraph): AnthropicTextBlock[] {
  return [
    {
      type: 'text',
      text: `You are the documentation assistant for this site. Answer the user's question using ONLY the documentation sections returned by the search tool.

You decide how many searches to run. Issue focused sub-queries with the search tool: vary terms, try synonyms, and decompose multi-part questions. When you have gathered enough context, stop calling the search tool and write your answer.

Write a short, direct answer in Markdown:
- Start IMMEDIATELY with the substance. Your first sentence must answer the question. Never open with "Based on…", "Here is…", "Sure", a restatement of the question, or any summary/preamble.
- Keep it tight: one or two short paragraphs, plus a short bullet list only if it genuinely helps. This renders in a small search popover, so do NOT use headings (#, ##) or horizontal rules (---).
- Ground every claim in the retrieved sections.
- When you reference a section, link to it inline using its exact \`url\` from the search results, for example: [autoscaling](/docs/concepts#kubernetes-autoscaling). Never invent a URL or anchor — only link to URLs that appear in the search results.
- If the documentation does not cover the question, say so plainly in one sentence and do not fabricate an answer.`,
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
      text: `You have finished gathering context. Write the answer now. Use only these URLs when linking:\n${list}`,
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

function lastRole(messages: AnthropicMessage[]): AnthropicMessage['role'] | undefined {
  return messages[messages.length - 1]?.role;
}

function normalizeToolQuery(input: unknown): string {
  return typeof (input as { query?: unknown })?.query === 'string' ? (input as { query: string }).query.trim() : '';
}

export function toolUse(id: string, name: string, input: unknown): AnthropicResponse['content'][number] {
  return { type: 'tool_use', id, name, input };
}
