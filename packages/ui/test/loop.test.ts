import assert from 'node:assert/strict';
import test from 'node:test';
import type { CallClaude } from '../src/search/loop.ts';
import { runAgenticSearchLoop, toolUse } from '../src/search/loop.ts';
import { chunkDocument, type Chunk } from '../src/search/chunk.ts';
import type { KnowledgeGraph } from '../src/kg/schema.ts';

const kg: KnowledgeGraph = {
  version: 1,
  generatedAt: '',
  contentHash: '',
  context: 'Layer concepts and operations.',
  glossary: [],
};

test('agentic loop handles two searches, dedupes picks, and applies maxResults', async () => {
  const chunks = makeChunks();
  const calls: Array<{ toolChoice: unknown; messages: unknown }> = [];
  const mock: CallClaude = async (opts) => {
    calls.push({ toolChoice: opts.toolChoice, messages: opts.messages });
    if (calls.length === 1) return { stop_reason: 'tool_use', content: [toolUse('s1', 'search', { query: 'autoscaling' })] };
    if (calls.length === 2) return { stop_reason: 'tool_use', content: [toolUse('s2', 'search', { query: 'pipeline commands' })] };
    return {
      stop_reason: 'tool_use',
      content: [
        toolUse('p1', 'present_results', {
          results: [
            { id: 'concepts#kubernetes-autoscaling', snippet: 'Autoscaling details.' },
            { id: 'concepts#kubernetes-autoscaling', snippet: 'Duplicate should be ignored.' },
            { id: 'missing', snippet: 'Unknown id should be ignored.' },
            { id: 'cli#pipeline-commands', snippet: 'CLI commands.' },
          ],
        }),
      ],
    };
  };

  const result = await runAgenticSearchLoop({
    apiKey: 'test-key',
    query: 'how does scaling work?',
    chunks,
    kg,
    config: {
      model: 'test-model',
      maxIterations: 4,
      candidatePerSearch: 5,
      perDocCap: 1,
      maxResults: 1,
    },
    call: mock,
  });

  assert.deepEqual(result.searches, ['autoscaling', 'pipeline commands']);
  assert.deepEqual(result.results, [
    {
      title: 'Core Concepts',
      heading: 'Kubernetes autoscaling',
      url: '/docs/concepts#kubernetes-autoscaling',
      group: undefined,
      snippet: 'Autoscaling details.',
    },
  ]);
  assert.equal(calls.length, 3);
});

test('agentic loop forces present_results after a non-tool response', async () => {
  const chunks = makeChunks();
  const calls: Array<{ toolChoice: unknown; messages: unknown }> = [];
  const mock: CallClaude = async (opts) => {
    calls.push({ toolChoice: opts.toolChoice, messages: opts.messages });
    if (calls.length === 1) return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'No tool.' }] };
    return {
      stop_reason: 'tool_use',
      content: [
        toolUse('p1', 'present_results', {
          results: [{ id: 'concepts#kubernetes-autoscaling', snippet: 'Fallback autoscaling result.' }],
        }),
      ],
    };
  };

  const result = await runAgenticSearchLoop({
    apiKey: 'test-key',
    query: 'autoscaling',
    chunks,
    kg,
    config: {
      model: 'test-model',
      maxIterations: 4,
      candidatePerSearch: 5,
      perDocCap: 2,
      maxResults: 6,
    },
    call: mock,
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].toolChoice, { type: 'tool', name: 'present_results' });
  assert.deepEqual(result.searches, ['autoscaling']);
  assert.equal(result.results[0].url, '/docs/concepts#kubernetes-autoscaling');
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
