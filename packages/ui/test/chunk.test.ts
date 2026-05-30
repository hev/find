import assert from 'node:assert/strict';
import test from 'node:test';
import { chunkDocument } from '../src/search/chunk.ts';
import { prefilter } from '../src/search/prefilter.ts';

test('chunkDocument matches GitHub-style duplicate and numeric heading anchors', () => {
  const chunks = chunkDocument(
    {
      slug: 'concepts',
      title: 'Concepts',
      group: 'Guide',
      description: 'Intro description.',
      body: [
        'Opening text.',
        '',
        '## 0.1 Release',
        'Release notes.',
        '',
        '## Cache warm hint — `GET /v1/namespaces/{ns}/hint_cache_warm`',
        'Endpoint with an underscore.',
        '',
        '#### Repeated',
        'Lower-level headings reserve slugs.',
        '',
        '## Repeated',
        'First indexed repeated heading.',
        '',
        '## Repeated',
        'Second indexed repeated heading.',
      ].join('\n'),
    },
    '/docs/',
    3,
  );

  assert.deepEqual(
    chunks.map((chunk) => [chunk.id, chunk.url]),
    [
      ['concepts', '/docs/concepts'],
      ['concepts#01-release', '/docs/concepts#01-release'],
      [
        'concepts#cache-warm-hint--get-v1namespacesnshint_cache_warm',
        '/docs/concepts#cache-warm-hint--get-v1namespacesnshint_cache_warm',
      ],
      ['concepts#repeated-1', '/docs/concepts#repeated-1'],
      ['concepts#repeated-2', '/docs/concepts#repeated-2'],
    ],
  );
});

test('prefilter expands glossary terms and caps results per document', () => {
  const chunks = chunkDocument(
    {
      slug: 'concepts',
      title: 'Core Concepts',
      body: [
        'Intro.',
        '## Kubernetes autoscaling',
        'Lag signals scale workers.',
        '## Backpressure',
        'Flow control protects sinks.',
      ].join('\n'),
    },
    '/docs/',
    3,
  );

  const results = prefilter(
    chunks,
    'k8s scaling',
    [
      {
        term: 'Kubernetes autoscaling',
        aliases: ['k8s scaling'],
        definition: 'Scale workers from lag signals.',
      },
    ],
    5,
    1,
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'concepts#kubernetes-autoscaling');
});
