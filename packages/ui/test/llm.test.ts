import assert from 'node:assert/strict';
import test from 'node:test';
import { newSseState, parseSseChunk, type StreamEvent } from '../src/llm.ts';

function frame(type: string, payload: Record<string, unknown> = {}): string {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`;
}

test('parseSseChunk surfaces text deltas and ignores ping/message_start', () => {
  const state = newSseState();
  const input =
    frame('message_start') +
    frame('ping') +
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text"}}\n\n' +
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello "}}\n\n' +
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"world"}}\n\n';
  const { events } = parseSseChunk(input, state);
  const text = events.filter((e): e is Extract<StreamEvent, { type: 'text' }> => e.type === 'text').map((e) => e.text).join('');
  assert.equal(text, 'Hello world');
});

test('parseSseChunk reconstructs a tool_use block from split input_json deltas', () => {
  const state = newSseState();
  const input =
    'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"t1","name":"search"}}\n\n' +
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"query\\":\\"auto"}}\n\n' +
    'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"scaling\\"}"}}\n\n' +
    'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n';
  const { events } = parseSseChunk(input, state);
  const tool = events.find((e): e is Extract<StreamEvent, { type: 'tool_use' }> => e.type === 'tool_use');
  assert.ok(tool);
  assert.equal(tool.id, 't1');
  assert.equal(tool.name, 'search');
  assert.deepEqual(tool.input, { query: 'autoscaling' });
});

test('parseSseChunk carries a partial frame across chunks', () => {
  let state = newSseState();
  const part1 = 'event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_';
  const part2 = 'delta","text":"hi"}}\n\n';
  let out = parseSseChunk(part1, state);
  assert.equal(out.events.length, 0, 'incomplete frame yields nothing yet');
  state = out.state;
  out = parseSseChunk(part2, state);
  assert.deepEqual(out.events, [{ type: 'text', text: 'hi' }]);
});

test('parseSseChunk surfaces stop_reason from message_delta', () => {
  const { events } = parseSseChunk(
    'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n',
    newSseState(),
  );
  assert.deepEqual(events, [{ type: 'stop', stopReason: 'end_turn' }]);
});
