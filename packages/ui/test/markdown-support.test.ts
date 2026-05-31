import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkdown, type Source } from '../src/components/markdown.ts';

const source: Source = {
  title: 'Concepts',
  heading: 'Autoscaling',
  url: '/docs/concepts#autoscaling',
  terms: ['autoscaling', 'workers', 'signals'],
};

test('a cited link survives when its text shares a distinctive term', () => {
  const html = renderMarkdown('Autoscaling scales [workers](/docs/concepts#autoscaling).', [source]);
  assert.ok(html.includes('<a class="as-answer-link" href="/docs/concepts#autoscaling"'));
  assert.ok(html.includes('>workers</a>'));
});

test('a misattributed link (no shared term) degrades to plain text', () => {
  const html = renderMarkdown('Pricing tiers are listed [here](/docs/concepts#autoscaling).', [source]);
  assert.ok(!html.includes('<a'), 'no anchor emitted');
  assert.ok(html.includes('here'), 'label remains as plain text');
});

test('a source without terms is never degraded on support grounds (lenient)', () => {
  const noTerms: Source = { title: 'X', url: '/docs/x' };
  const html = renderMarkdown('Totally unrelated [x](/docs/x).', [noTerms]);
  assert.ok(html.includes('<a class="as-answer-link" href="/docs/x"'));
});
