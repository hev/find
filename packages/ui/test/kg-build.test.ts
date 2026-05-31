import assert from 'node:assert/strict';
import test from 'node:test';
import { assembleGraph, corpusSections, parseEmittedGraph, type CorpusBuild } from '../src/kg/build.ts';
import { tokenize, type Chunk } from '../src/search/chunk.ts';

function chunk(id: string, heading: string, raw: string): Chunk {
  const docSlug = id.split('#')[0];
  return {
    id,
    docSlug,
    docTitle: 'Docs',
    group: 'Overview',
    heading,
    anchorId: id.split('#')[1],
    url: `/docs/${docSlug}#${id.split('#')[1]}`,
    text: raw,
    raw,
    tokens: new Set(tokenize(raw)),
  };
}

const corpus: CorpusBuild = {
  documents: [],
  chunks: [chunk('concepts#flags', 'Flags', 'Pass `--max-workers` to scale workers.')],
  contentHash: 'hash123',
};

test('parseEmittedGraph reads summaries and suggestions, ignoring junk', () => {
  const emitted = parseEmittedGraph({
    context: 'A docs site.',
    glossary: [{ term: 'workers', aliases: ['worker'], definition: 'Processes.' }],
    summaries: [
      { id: 'concepts#flags', summary: '  Scales workers.  ' },
      { id: 'concepts#flags' }, // no summary → dropped
    ],
    suggestions: ['How do I scale?', '', 7],
  });
  assert.equal(emitted.context, 'A docs site.');
  assert.equal(emitted.summaries.length, 1);
  assert.equal(emitted.summaries[0].summary, 'Scales workers.', 'summary is trimmed');
  assert.deepEqual(emitted.suggestions, ['How do I scale?']);
});

test('assembleGraph carries suggestions and derives facts deterministically', () => {
  const graph = assembleGraph(
    {
      context: 'ctx',
      glossary: [],
      summaries: [{ id: 'concepts#flags', summary: 'Scales workers.' }],
      suggestions: ['How do I scale workers?'],
    },
    corpus,
  );
  assert.equal(graph.version, 2);
  assert.equal(graph.contentHash, 'hash123');
  assert.deepEqual(graph.suggestions, ['How do I scale workers?']);
  assert.equal(graph.nodes.length, 1);
  assert.equal(graph.nodes[0].summary, 'Scales workers.');
  // The flag is extracted verbatim by code, never authored by the model.
  assert.ok(
    graph.nodes[0].facts.some((fact) => fact.literal === '--max-workers'),
    'verbatim flag is extracted into facts',
  );
});

test('corpusSections projects chunks into the model-input shape', () => {
  const sections = corpusSections(corpus);
  assert.deepEqual(sections, [
    {
      id: 'concepts#flags',
      url: '/docs/concepts#flags',
      title: 'Docs > Flags',
      text: 'Pass `--max-workers` to scale workers.',
    },
  ]);
});
