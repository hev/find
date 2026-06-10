import assert from 'node:assert/strict';
import test from 'node:test';
import {
  flushOpenAiSse,
  newOpenAiSseState,
  parseOpenAiSseChunk,
  toOpenAiMessages,
  toOpenAiRequest,
  type OpenAiEndpoint,
} from '../src/llm-openai.ts';
import { clientFor, resolveProviderName, PROVIDERS } from '../src/providers.ts';
import type { CallClaudeOptions, StreamEvent } from '../src/llm.ts';

const endpoint: OpenAiEndpoint = {
  baseUrl: 'https://api.openai.com/v1',
  tokenParam: 'max_completion_tokens',
  label: 'OpenAI',
};

function baseOptions(overrides: Partial<CallClaudeOptions> = {}): CallClaudeOptions {
  return {
    apiKey: 'sk-test',
    model: 'gpt-4.1-mini',
    system: [
      { type: 'text', text: 'You are a docs assistant.' },
      { type: 'text', text: '<map>…</map>', cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: 'Query: how do anchors work?' }],
    ...overrides,
  };
}

test('toOpenAiMessages folds system blocks and converts tool turns both ways', () => {
  const messages = toOpenAiMessages({
    system: baseOptions().system,
    messages: [
      { role: 'user', content: 'Query: anchors?' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me look.' },
          { type: 'tool_use', id: 'call_1', name: 'open_section', input: { id: 'concepts#anchors' } },
        ],
      },
      {
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: 'call_1', content: '{"summary":"…"}' }],
      },
    ],
  });

  assert.equal(messages[0].role, 'system');
  assert.equal(messages[0].content, 'You are a docs assistant.\n\n<map>…</map>');
  assert.equal(messages[1].role, 'user');
  assert.equal(messages[2].role, 'assistant');
  assert.equal(messages[2].content, 'Let me look.');
  assert.deepEqual(messages[2].tool_calls, [
    {
      id: 'call_1',
      type: 'function',
      function: { name: 'open_section', arguments: '{"id":"concepts#anchors"}' },
    },
  ]);
  assert.equal(messages[3].role, 'tool');
  assert.equal(messages[3].tool_call_id, 'call_1');
  assert.equal(messages[3].content, '{"summary":"…"}');
});

test('toOpenAiMessages sends a tool-only assistant turn with null content', () => {
  const messages = toOpenAiMessages({
    system: 'sys',
    messages: [
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'call_2', name: 'search', input: { query: 'x' } }],
      },
    ],
  });
  assert.equal(messages[1].content, null);
  assert.equal(messages[1].tool_calls?.length, 1);
});

test('toOpenAiRequest maps tools, forced tool_choice, and the token param', () => {
  const body = toOpenAiRequest(
    baseOptions({
      maxTokens: 512,
      tools: [{ name: 'search', description: 'Search docs.', input_schema: { type: 'object' } }],
      toolChoice: { type: 'tool', name: 'search' },
    }),
    endpoint,
    false,
  );
  assert.equal(body.max_completion_tokens, 512);
  assert.equal(body.max_tokens, undefined);
  assert.deepEqual(body.tools, [
    { type: 'function', function: { name: 'search', description: 'Search docs.', parameters: { type: 'object' } } },
  ]);
  assert.deepEqual(body.tool_choice, { type: 'function', function: { name: 'search' } });
  assert.equal(body.stream, undefined);
});

test('toOpenAiRequest uses max_tokens for OpenRouter and asks for streamed usage', () => {
  const body = toOpenAiRequest(
    baseOptions({ maxTokens: 256, toolChoice: { type: 'auto' } }),
    { ...endpoint, tokenParam: 'max_tokens', label: 'OpenRouter' },
    true,
  );
  assert.equal(body.max_tokens, 256);
  assert.equal(body.tool_choice, 'auto');
  assert.equal(body.stream, true);
  assert.deepEqual(body.stream_options, { include_usage: true });
});

function sse(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

test('parseOpenAiSseChunk surfaces text deltas and final usage', () => {
  let state = newOpenAiSseState();
  const input =
    ': OPENROUTER PROCESSING\n\n' +
    sse({ choices: [{ delta: { role: 'assistant', content: 'Hello ' } }] }) +
    sse({ choices: [{ delta: { content: 'world' } }] }) +
    sse({ choices: [{ delta: {}, finish_reason: 'stop' }] }) +
    sse({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 5 } }) +
    'data: [DONE]\n\n';
  const { events } = parseOpenAiSseChunk(input, state);
  const text = events
    .filter((e): e is Extract<StreamEvent, { type: 'text' }> => e.type === 'text')
    .map((e) => e.text)
    .join('');
  assert.equal(text, 'Hello world');
  const stop = events.find((e): e is Extract<StreamEvent, { type: 'stop' }> => e.type === 'stop');
  assert.ok(stop);
  assert.equal(stop.stopReason, 'end_turn');
  assert.deepEqual(stop.usage, { input_tokens: 12, output_tokens: 5 });
});

test('parseOpenAiSseChunk reassembles tool calls split across argument deltas', () => {
  const input =
    sse({
      choices: [
        { delta: { tool_calls: [{ index: 0, id: 'call_9', function: { name: 'search', arguments: '{"que' } }] } },
      ],
    }) +
    sse({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ry":"anchors"}' } }] } }] }) +
    sse({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] }) +
    'data: [DONE]\n\n';
  const { events } = parseOpenAiSseChunk(input, newOpenAiSseState());
  const tool = events.find((e): e is Extract<StreamEvent, { type: 'tool_use' }> => e.type === 'tool_use');
  assert.ok(tool);
  assert.equal(tool.id, 'call_9');
  assert.equal(tool.name, 'search');
  assert.deepEqual(tool.input, { query: 'anchors' });
  const stop = events.find((e): e is Extract<StreamEvent, { type: 'stop' }> => e.type === 'stop');
  assert.equal(stop?.stopReason, 'tool_use');
});

test('parseOpenAiSseChunk carries a partial frame across chunks', () => {
  const whole = sse({ choices: [{ delta: { content: 'hi' } }] });
  let out = parseOpenAiSseChunk(whole.slice(0, 18), newOpenAiSseState());
  assert.equal(out.events.length, 0, 'incomplete frame yields nothing yet');
  out = parseOpenAiSseChunk(whole.slice(18), out.state);
  assert.deepEqual(out.events, [{ type: 'text', text: 'hi' }]);
});

test('flushOpenAiSse emits exactly once even if [DONE] already flushed', () => {
  const { state } = parseOpenAiSseChunk(
    sse({ choices: [{ delta: { content: 'x' }, finish_reason: 'stop' }] }) + 'data: [DONE]\n\n',
    newOpenAiSseState(),
  );
  assert.deepEqual(flushOpenAiSse(state), []);
});

test('resolveProviderName validates and defaults', () => {
  assert.equal(resolveProviderName(undefined), 'anthropic');
  assert.equal(resolveProviderName('openrouter'), 'openrouter');
  assert.throws(() => resolveProviderName('gemini'), /Unknown provider/);
});

test('clientFor sends Chat Completions requests with a bearer key', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! });
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: 'Anchors come from github-slugger.' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 9, completion_tokens: 7 },
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  try {
    const { call } = clientFor('openrouter');
    const response = await call(baseOptions({ model: PROVIDERS.openrouter.defaultModel }));
    assert.equal(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions');
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.authorization, 'Bearer sk-test');
    const body = JSON.parse(String(calls[0].init.body));
    assert.equal(body.model, PROVIDERS.openrouter.defaultModel);
    assert.equal(body.max_tokens, 2048);
    assert.deepEqual(response.content, [{ type: 'text', text: 'Anchors come from github-slugger.' }]);
    assert.equal(response.stop_reason, 'end_turn');
    assert.deepEqual(response.usage, { input_tokens: 9, output_tokens: 7 });
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('clientFor honors a base URL override', async () => {
  const urls: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request) => {
    urls.push(String(url));
    return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }), {
      status: 200,
    });
  }) as typeof fetch;

  try {
    const { call } = clientFor('openai', 'https://my-gateway.example.com/v1/');
    await call(baseOptions());
    assert.equal(urls[0], 'https://my-gateway.example.com/v1/chat/completions');
  } finally {
    globalThis.fetch = realFetch;
  }
});
