import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_KG, normalizeKnowledgeGraph } from '../src/kg/schema.ts';

test('normalizeKnowledgeGraph returns an empty v2 graph for junk', () => {
  assert.deepEqual(normalizeKnowledgeGraph(null), EMPTY_KG);
  assert.deepEqual(normalizeKnowledgeGraph('nope'), EMPTY_KG);
  assert.equal(EMPTY_KG.version, 2);
});

test('a v1 artifact degrades to a node-less v2 graph (keeps context + glossary)', () => {
  const v1 = {
    version: 1,
    contentHash: 'abc',
    context: 'Layer concepts.',
    glossary: [{ term: 'pipeline', aliases: ['stream'], definition: 'A flow.' }],
  };
  const kg = normalizeKnowledgeGraph(v1);
  assert.equal(kg.version, 2);
  assert.equal(kg.context, 'Layer concepts.');
  assert.equal(kg.glossary.length, 1);
  assert.deepEqual(kg.nodes, []);
  assert.equal(kg.overview, '');
});

test('v2 nodes round-trip and bad fields are coerced', () => {
  const kg = normalizeKnowledgeGraph({
    version: 2,
    nodes: [
      {
        id: 'concepts#autoscaling',
        kind: 'section',
        title: 'Concepts',
        heading: 'Autoscaling',
        group: 'Overview',
        url: '/docs/concepts#autoscaling',
        summary: 'Scales workers from lag.',
        facts: [{ kind: 'flag', literal: '--max-workers', chunkId: 'concepts#autoscaling' }],
        sources: [{ chunkId: 'concepts#autoscaling', url: '/docs/concepts#autoscaling', anchor: 'autoscaling' }],
        mode: 'bogus-mode',
        terms: ['autoscaling', 'workers'],
      },
      { kind: 'section' }, // no id/url → dropped
    ],
  });
  assert.equal(kg.nodes.length, 1);
  const node = kg.nodes[0];
  assert.equal(node.mode, 'agent-primary', 'invalid mode coerced to default');
  assert.equal(node.facts[0].literal, '--max-workers');
  assert.equal(node.sources[0].anchor, 'autoscaling');
  assert.deepEqual(node.terms, ['autoscaling', 'workers']);
});
