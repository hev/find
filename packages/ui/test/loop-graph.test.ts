import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgenticEvent, CallClaude, StreamClaude } from '../src/search/loop.ts';
import { runAgenticAnswerLoop, toolUse } from '../src/search/loop.ts';
import type { StreamEvent } from '../src/llm.ts';
import { chunkDocument, type Chunk } from '../src/search/chunk.ts';
import { buildNodes } from '../src/kg/build.ts';
import type { KnowledgeGraph } from '../src/kg/schema.ts';

const config = {
  model: 'test-model',
  maxIterations: 4,
  candidatePerSearch: 5,
  perDocCap: 2,
  maxResults: 6,
  answerMaxTokens: 512,
};

function makeChunks(): Chunk[] {
  return [
    ...chunkDocument(
      {
        slug: 'concepts',
        title: 'Core Concepts',
        group: 'Overview',
        body: ['Intro.', '## Kubernetes autoscaling', 'Autoscaling scales workers with `--max-workers` from lag signals.'].join('\n'),
      },
      '/docs/',
      3,
    ),
    ...chunkDocument(
      {
        slug: 'cli',
        title: 'CLI',
        group: 'Reference',
        body: ['Intro.', '## Pipeline commands', 'Run `layer pipeline run` to start a pipeline.'].join('\n'),
      },
      '/docs/',
      3,
    ),
  ];
}

function graph(): KnowledgeGraph {
  return {
    version: 2,
    generatedAt: '',
    contentHash: '',
    context: '',
    glossary: [],
    overview: '## Overview\n- Kubernetes autoscaling — `concepts#kubernetes-autoscaling`',
    nodes: buildNodes(makeChunks(), new Map()),
    edges: [],
  };
}

function streamText(...chunks: string[]): StreamClaude {
  return async function* () {
    for (const text of chunks) yield { type: 'text', text } as StreamEvent;
    yield { type: 'stop', stopReason: 'end_turn' } as StreamEvent;
  } as unknown as StreamClaude;
}

async function drain(gen: AsyncGenerator<AgenticEvent>): Promise<AgenticEvent[]> {
  const events: AgenticEvent[] = [];
  for await (const ev of gen) events.push(ev);
  return events;
}

test('graph loop opens a section, emits sources before tokens, then streams', async () => {
  const seenMessages: unknown[][] = [];
  const call: CallClaude = async (opts) => {
    seenMessages.push(opts.messages as unknown[]);
    assert.equal((opts.tools ?? [])[0]?.name, 'open_section', 'graph path offers open_section, not search');
    if (seenMessages.length === 1) {
      return { stop_reason: 'tool_use', content: [toolUse('o1', 'open_section', { id: 'concepts#kubernetes-autoscaling' })] };
    }
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Ready.' }] };
  };

  const events = await drain(
    runAgenticAnswerLoop({
      apiKey: 'k',
      query: 'how does scaling work?',
      chunks: makeChunks(),
      kg: graph(),
      config,
      call,
      stream: streamText('Autoscaling scales workers. ', 'See [autoscaling](/docs/concepts#kubernetes-autoscaling).'),
    }),
  );

  const searches = events.filter((e) => e.type === 'search').map((e) => (e as { query: string }).query);
  assert.deepEqual(searches, ['Kubernetes autoscaling'], 'open emits the section heading as a search chip');

  const sourcesIndex = events.findIndex((e) => e.type === 'sources');
  const firstTokenIndex = events.findIndex((e) => e.type === 'token');
  assert.ok(sourcesIndex !== -1 && sourcesIndex < firstTokenIndex, 'sources before tokens');

  const sources = (events[sourcesIndex] as { sources: Array<{ url: string; terms?: string[] }> }).sources;
  assert.ok(sources.some((s) => s.url === '/docs/concepts#kubernetes-autoscaling'));
  assert.ok(sources[0].terms && sources[0].terms.length > 0, 'sources carry terms for the support check');

  assert.equal(events.at(-1)?.type, 'done');

  // The opened section's verbatim fact must reach the model in the tool result.
  const toolResultJson = JSON.stringify(seenMessages[1]);
  assert.ok(toolResultJson.includes('--max-workers'), 'open_section surfaces verbatim facts');
});

test('graph loop falls back to opening top matches when the model opens nothing', async () => {
  const call: CallClaude = async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'no open' }] });

  const events = await drain(
    runAgenticAnswerLoop({
      apiKey: 'k',
      query: 'autoscaling workers',
      chunks: makeChunks(),
      kg: graph(),
      config,
      call,
      stream: streamText('Grounded.'),
    }),
  );

  const sources = (events.find((e) => e.type === 'sources') as { sources: unknown[] }).sources;
  assert.ok(sources.length > 0, 'fallback opens sections to ground the answer');
  assert.ok(events.some((e) => e.type === 'search'), 'fallback emits an open event');
});

test('a node-less (v1) graph still uses the legacy search tool', async () => {
  const v1: KnowledgeGraph = {
    version: 2,
    generatedAt: '',
    contentHash: '',
    context: 'ctx',
    glossary: [],
    overview: '',
    nodes: [],
    edges: [],
  };
  const tools: string[] = [];
  const call: CallClaude = async (opts) => {
    tools.push((opts.tools ?? [])[0]?.name ?? '');
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'x' }] };
  };
  await drain(
    runAgenticAnswerLoop({ apiKey: 'k', query: 'q', chunks: makeChunks(), kg: v1, config, call, stream: streamText('a') }),
  );
  assert.ok(tools.includes('search'), 'legacy path offers the search tool');
});
