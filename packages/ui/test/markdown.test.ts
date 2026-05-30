import assert from 'node:assert/strict';
import test from 'node:test';
import { renderMarkdown, escapeHtml, sourceBreadcrumb, type Source } from '../src/components/markdown.ts';

const sources: Source[] = [
  { title: 'Core Concepts', heading: 'Kubernetes autoscaling', url: '/docs/concepts#kubernetes-autoscaling', group: 'Overview' },
];

test('escapes HTML in model output', () => {
  const html = renderMarkdown('a <script>alert(1)</script> b', sources);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('renders an allowed link as an anchor with a breadcrumb title', () => {
  const html = renderMarkdown('See [autoscaling](/docs/concepts#kubernetes-autoscaling).', sources);
  assert.match(html, /<a class="as-answer-link" href="\/docs\/concepts#kubernetes-autoscaling" title="Overview › Kubernetes autoscaling">autoscaling<\/a>/);
});

test('downgrades an unknown (hallucinated) link to plain text', () => {
  const html = renderMarkdown('See [fake](/docs/does-not-exist).', sources);
  assert.ok(!html.includes('<a'));
  assert.ok(html.includes('fake'));
});

test('renders an unterminated link literally (streaming-safe)', () => {
  const html = renderMarkdown('See [autoscaling](/docs/conce', sources);
  assert.ok(!html.includes('<a'));
  assert.ok(html.includes('[autoscaling]('));
});

test('renders bold, inline code, and lists', () => {
  assert.match(renderMarkdown('**bold**'), /<strong>bold<\/strong>/);
  assert.match(renderMarkdown('use `npm`'), /<code>npm<\/code>/);
  const list = renderMarkdown('- one\n- two');
  assert.match(list, /<ul><li>one<\/li><li>two<\/li><\/ul>/);
  const ordered = renderMarkdown('1. first\n2. second');
  assert.match(ordered, /<ol><li>first<\/li><li>second<\/li><\/ol>/);
});

test('sourceBreadcrumb joins group and heading', () => {
  assert.equal(sourceBreadcrumb(sources[0]), 'Overview › Kubernetes autoscaling');
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
});
