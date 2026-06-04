import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getGlossaryEntry,
  getOverview,
  getSection,
  listGlossary,
  listSectionSummaries,
} from '../src/kg/read.ts';
import type { KnowledgeGraph } from '../src/kg/schema.ts';

const graph: KnowledgeGraph = {
  version: 2,
  generatedAt: '',
  contentHash: '',
  context: 'Orientation text.',
  glossary: [
    {
      term: 'Knowledge graph',
      aliases: ['kg', 'shadow site'],
      definition: 'The committed distilled docs artifact.',
    },
  ],
  overview: '## Overview\n- CLI - `api/cli#flags`',
  suggestions: [],
  nodes: [
    {
      id: 'index#quick-start',
      kind: 'section',
      title: 'Introduction',
      heading: 'Quick start',
      group: 'Overview',
      url: '/docs#quick-start',
      summary: 'Install the integration.',
      facts: [],
      sources: [{ chunkId: 'index#quick-start', url: '/docs#quick-start', anchor: 'quick-start' }],
      mode: 'agent-primary',
      terms: ['install'],
    },
    {
      id: 'api/cli#flags',
      kind: 'section',
      title: 'CLI',
      heading: 'Flags',
      group: 'API',
      url: '/docs/api/cli#flags',
      summary: 'Command flags.',
      facts: [{ kind: 'flag', literal: '--kg-path', chunkId: 'api/cli#flags' }],
      sources: [{ chunkId: 'api/cli#flags', url: '/docs/api/cli#flags', anchor: 'flags' }],
      mode: 'source-primary',
      terms: ['flags'],
    },
  ],
  edges: [],
};

test('read API lists and resolves glossary terms by term or alias', () => {
  assert.equal(listGlossary(graph).length, 1);
  assert.equal(getGlossaryEntry(graph, 'knowledge graph')?.definition, 'The committed distilled docs artifact.');
  assert.equal(getGlossaryEntry(graph, 'KG')?.term, 'Knowledge graph');
  assert.equal(getGlossaryEntry(graph, 'missing'), null);
});

test('read API lists section summaries and filters by group case-insensitively', () => {
  const all = listSectionSummaries(graph);
  assert.deepEqual(
    all.map((section) => section.id),
    ['index#quick-start', 'api/cli#flags'],
  );

  const api = listSectionSummaries(graph, 'api');
  assert.deepEqual(api, [
    {
      id: 'api/cli#flags',
      title: 'CLI',
      heading: 'Flags',
      group: 'API',
      url: '/docs/api/cli#flags',
    },
  ]);
});

test('read API resolves encoded section ids with slashes and anchors', () => {
  assert.equal(getSection(graph, 'api%2Fcli%23flags')?.summary, 'Command flags.');
  assert.equal(getSection(graph, 'api/cli%23flags')?.facts[0]?.literal, '--kg-path');
  assert.equal(getSection(graph, 'api/cli#missing'), null);
});

test('read API returns overview and context together', () => {
  assert.deepEqual(getOverview(graph), {
    overview: '## Overview\n- CLI - `api/cli#flags`',
    context: 'Orientation text.',
  });
});
