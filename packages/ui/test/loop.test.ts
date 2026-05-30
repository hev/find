import assert from 'node:assert/strict';
import test from 'node:test';
import type { AgenticEvent, CallClaude, StreamClaude } from '../src/search/loop.ts';
import { runAgenticAnswerLoop, toolUse } from '../src/search/loop.ts';
import type { StreamEvent } from '../src/llm.ts';
import { chunkDocument, type Chunk } from '../src/search/chunk.ts';
import type { KnowledgeGraph } from '../src/kg/schema.ts';

const kg: KnowledgeGraph = {
  version: 1,
  generatedAt: '',
  contentHash: '',
  context: 'Layer concepts and operations.',
  glossary: [],
};

const config = {
  model: 'test-model',
  maxIterations: 4,
  candidatePerSearch: 5,
  perDocCap: 2,
  maxResults: 6,
  answerMaxTokens: 512,
};

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

test('answer loop runs searches, emits sources before tokens, then streams the answer', async () => {
  const calls: Array<{ toolChoice: unknown; tools: unknown }> = [];
  const call: CallClaude = async (opts) => {
    calls.push({ toolChoice: opts.toolChoice, tools: opts.tools });
    if (calls.length === 1) return { stop_reason: 'tool_use', content: [toolUse('s1', 'search', { query: 'autoscaling' })] };
    if (calls.length === 2) return { stop_reason: 'tool_use', content: [toolUse('s2', 'search', { query: 'pipeline commands' })] };
    return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Ready to answer.' }] };
  };

  const events = await drain(
    runAgenticAnswerLoop({
      apiKey: 'test-key',
      query: 'how does scaling work?',
      chunks: makeChunks(),
      kg,
      config,
      call,
      stream: streamText('Auto', 'scaling scales workers. ', 'See [autoscaling](/docs/concepts#kubernetes-autoscaling).'),
    }),
  );

  const searches = events.filter((e) => e.type === 'search').map((e) => (e as { query: string }).query);
  assert.deepEqual(searches, ['autoscaling', 'pipeline commands']);

  const sourcesIndex = events.findIndex((e) => e.type === 'sources');
  const firstTokenIndex = events.findIndex((e) => e.type === 'token');
  assert.ok(sourcesIndex !== -1, 'a sources event is emitted');
  assert.ok(sourcesIndex < firstTokenIndex, 'sources are emitted before any token');

  const sources = (events[sourcesIndex] as { sources: Array<{ url: string }> }).sources;
  assert.ok(sources.some((s) => s.url === '/docs/concepts#kubernetes-autoscaling'));
  // Deduped by url, capped at maxResults.
  assert.equal(new Set(sources.map((s) => s.url)).size, sources.length);
  assert.ok(sources.length <= config.maxResults);

  const answer = events
    .filter((e) => e.type === 'token')
    .map((e) => (e as { text: string }).text)
    .join('');
  assert.equal(answer, 'Autoscaling scales workers. See [autoscaling](/docs/concepts#kubernetes-autoscaling).');

  assert.equal(events.at(-1)?.type, 'done');
  // The phase-1 loop never forces a tool choice; it only offers the search tool.
  assert.deepEqual(calls[0].toolChoice, { type: 'auto' });
  assert.equal(calls.length, 3);
});

test('answer loop seeds a fallback search when the model never searches', async () => {
  const call: CallClaude = async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'no tool' }] });

  const events = await drain(
    runAgenticAnswerLoop({
      apiKey: 'test-key',
      query: 'autoscaling',
      chunks: makeChunks(),
      kg,
      config,
      call,
      stream: streamText('Grounded answer.'),
    }),
  );

  const searches = events.filter((e) => e.type === 'search').map((e) => (e as { query: string }).query);
  assert.deepEqual(searches, ['autoscaling']);
  const sources = (events.find((e) => e.type === 'sources') as { sources: unknown[] }).sources;
  assert.ok(sources.length > 0, 'fallback search grounds the answer');
});

function makeChunks(): Chunk[] {
  return [
    ...chunkDocument(
      {
        slug: 'concepts',
        title: 'Core Concepts',
        body: ['Intro.', '## Kubernetes autoscaling', 'Autoscaling uses lag signals to scale workers.'].join('\n'),
      },
      '/docs/',
      3,
    ),
    ...chunkDocument(
      {
        slug: 'cli',
        title: 'CLI Reference',
        body: ['Intro.', '## Pipeline commands', 'Run and list pipelines from the command line.'].join('\n'),
      },
      '/docs/',
      3,
    ),
  ];
}
