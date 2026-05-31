import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyMode, distinctiveTokens, extractFacts } from '../src/kg/facts.ts';

const raw = [
  '## Install',
  'Run `layer auth login` to authenticate.',
  'Use --skip-build to skip the build. The default model is claude-haiku-4-5.',
  'Pull the image from ghcr.io/layer/cli.',
  '```sh',
  'layer pipeline run my-pipe',
  '```',
].join('\n');

test('extractFacts lifts code, flags, identifiers, and fenced blocks verbatim', () => {
  const facts = extractFacts('install', raw);
  const literals = facts.map((fact) => fact.literal);

  assert.ok(literals.includes('layer auth login'), 'inline code');
  assert.ok(literals.includes('--skip-build'), 'flag');
  assert.ok(literals.includes('claude-haiku-4-5'), 'model identifier');
  assert.ok(literals.includes('ghcr.io'), 'dotted identifier');
  assert.ok(literals.includes('layer pipeline run my-pipe'), 'fenced code block');
  assert.ok(facts.every((fact) => fact.chunkId === 'install'), 'every fact carries its source chunk id');
});

test('extractFacts dedupes and never returns empties', () => {
  const facts = extractFacts('x', 'Use `--flag` and `--flag` again.');
  const flags = facts.filter((fact) => fact.literal === '--flag');
  assert.equal(flags.length, 1, 'duplicate literals collapse');
  assert.ok(facts.every((fact) => fact.literal.length >= 2));
});

test('classifyMode marks reference/API sections source-primary', () => {
  assert.equal(classifyMode('Reference'), 'source-primary');
  assert.equal(classifyMode('API'), 'source-primary');
  assert.equal(classifyMode('Overview'), 'agent-primary');
  assert.equal(classifyMode(undefined), 'agent-primary');
  assert.equal(classifyMode(null), 'agent-primary');
});

test('distinctiveTokens keeps meaningful words and drops stopwords/short words', () => {
  const tokens = distinctiveTokens('The pipeline scales workers using autoscaling and lag');
  assert.ok(tokens.includes('pipeline'));
  assert.ok(tokens.includes('autoscaling'));
  assert.ok(!tokens.includes('the'), 'stopword dropped');
  assert.ok(!tokens.includes('lag'), 'too short dropped');
  assert.ok(!tokens.includes('using'), 'stopword dropped');
});
