import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeTelemetry } from '../src/observability.ts';

interface Captured {
  url: string;
  body: { event: string; distinct_id: string; properties: Record<string, unknown> };
}

function spyFetch() {
  const calls: Captured[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) });
    return new Response('ok', { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const base = {
  spanId: 's1',
  spanName: 'turn 1',
  model: 'claude-haiku-4-5',
  input: [{ role: 'user', content: 'hi' }],
  output: [{ type: 'text', text: 'hello' }],
  usage: { input_tokens: 10, output_tokens: 4 },
  latencyMs: 1500,
  httpStatus: 200,
};

test('makeTelemetry is a no-op when no api key is configured', () => {
  const { calls, fetchImpl } = spyFetch();
  const t = makeTelemetry({ fetchImpl, randomId: () => 'trace-1' });
  t.generation(base);
  t.trace({ latencyMs: 100, ok: true });
  assert.equal(calls.length, 0);
  assert.equal(t.traceId, 'trace-1');
});

test('makeTelemetry emits $ai_generation with model, tokens, latency, and trace id', () => {
  const { calls, fetchImpl } = spyFetch();
  const t = makeTelemetry({ apiKey: 'phc_test', fetchImpl, randomId: () => 'trace-1' });
  t.generation(base);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://us.i.posthog.com/i/v0/e/');
  const { event, distinct_id, properties } = calls[0].body;
  assert.equal(event, '$ai_generation');
  assert.equal(distinct_id, 'anonymous');
  assert.equal(properties.$ai_trace_id, 'trace-1');
  assert.equal(properties.$ai_model, 'claude-haiku-4-5');
  assert.equal(properties.$ai_input_tokens, 10);
  assert.equal(properties.$ai_output_tokens, 4);
  assert.equal(properties.$ai_latency, 1.5);
  assert.equal(properties.$ai_provider, 'anthropic');
  assert.deepEqual(properties.$ai_input, base.input);
});

test('captureContent "off" omits prompt/response text but keeps metadata', () => {
  const { calls, fetchImpl } = spyFetch();
  const t = makeTelemetry({ apiKey: 'phc_test', captureContent: 'off', fetchImpl });
  t.generation(base);
  const { properties } = calls[0].body;
  assert.equal(properties.$ai_input, undefined);
  assert.equal(properties.$ai_output_choices, undefined);
  assert.equal(properties.$ai_input_tokens, 10);
});

test('captureContent "redacted" blanks tool_result bodies', () => {
  const { calls, fetchImpl } = spyFetch();
  const t = makeTelemetry({ apiKey: 'phc_test', captureContent: 'redacted', fetchImpl });
  t.generation({
    ...base,
    input: [
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'secret doc text' }] },
    ],
  });
  const input = calls[0].body.properties.$ai_input as Array<{ content: Array<{ content: string }> }>;
  assert.equal(input[0].content[0].content, '[redacted]');
});

test('makeTelemetry routes in-flight captures through waitUntil', () => {
  const { fetchImpl } = spyFetch();
  const promises: Promise<unknown>[] = [];
  const t = makeTelemetry({ apiKey: 'phc_test', fetchImpl, waitUntil: (p) => promises.push(p) });
  t.trace({ latencyMs: 100, ok: true });
  assert.equal(promises.length, 1);
});

test('makeTelemetry honors a custom host', () => {
  const { calls, fetchImpl } = spyFetch();
  const t = makeTelemetry({ apiKey: 'phc_test', host: 'https://eu.i.posthog.com/', fetchImpl });
  t.trace({ latencyMs: 100, ok: true });
  assert.equal(calls[0].url, 'https://eu.i.posthog.com/i/v0/e/');
});
