// Minimal Anthropic Messages API client over fetch — keeps the package free of
// runtime dependencies and edge-runtime friendly.

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: unknown;
}

export interface AnthropicTextBlock {
  type: 'text';
  text: string;
  cache_control?: { type: 'ephemeral' };
}

export interface AnthropicToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface CallClaudeOptions {
  apiKey: string;
  model: string;
  system: string | AnthropicTextBlock[];
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  toolChoice?: { type: 'tool'; name: string } | { type: 'auto' };
  maxTokens?: number;
  /** Aborts the upstream request when the client disconnects. */
  signal?: AbortSignal;
}

export interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface AnthropicResponse {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: unknown }
  >;
  stop_reason: string | null;
  /** Token counts returned by the Messages API; used for observability. */
  usage?: AnthropicUsage;
}

function requestBody(opts: CallClaudeOptions, stream: boolean) {
  return JSON.stringify({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    messages: opts.messages,
    tools: opts.tools,
    tool_choice: opts.toolChoice,
    stream: stream || undefined,
  });
}

function headers(apiKey: string) {
  return {
    'content-type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': API_VERSION,
  };
}

export async function callClaude(opts: CallClaudeOptions): Promise<AnthropicResponse> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: headers(opts.apiKey),
    body: requestBody(opts, false),
    signal: opts.signal,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 500)}`);
  }

  return (await res.json()) as AnthropicResponse;
}

/** High-level events surfaced from the Anthropic SSE stream. */
export type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'stop'; stopReason: string | null; usage?: AnthropicUsage };

/**
 * Streams a Messages API response, yielding text deltas as they arrive and
 * fully-reconstructed tool_use blocks once their streamed JSON input completes.
 */
export async function* streamClaude(opts: CallClaudeOptions): AsyncGenerator<StreamEvent> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: headers(opts.apiKey),
    body: requestBody(opts, true),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    const detail = res.ok ? 'no response body' : await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 500)}`);
  }

  const reader = res.body.getReader();
  // `{ stream: true }` so multibyte tokens split across network chunks decode
  // without producing replacement characters.
  const decoder = new TextDecoder('utf-8');
  const state = newSseState();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const { events, state: next } = parseSseChunk(decoder.decode(value, { stream: true }), state);
    Object.assign(state, next);
    for (const event of events) yield event;
  }
}

interface SseToolBlock {
  kind: 'tool_use';
  id: string;
  name: string;
  json: string;
}
interface SseTextBlock {
  kind: 'text';
}
type SseBlock = SseToolBlock | SseTextBlock;

export interface SseParseState {
  /** Bytes not yet terminated by a blank line. */
  buffer: string;
  /** Content blocks indexed by their position in the message. */
  blocks: Record<number, SseBlock>;
  /** Token usage accumulated from `message_start` / `message_delta` frames. */
  usage: AnthropicUsage;
}

export function newSseState(): SseParseState {
  return { buffer: '', blocks: {}, usage: { input_tokens: 0, output_tokens: 0 } };
}

/**
 * Pure, network-free SSE frame parser. Feeds on decoded text chunks and returns
 * any high-level events that completed, plus the carried-over parse state.
 */
export function parseSseChunk(
  chunk: string,
  prev: SseParseState,
): { events: StreamEvent[]; state: SseParseState } {
  const events: StreamEvent[] = [];
  const blocks = prev.blocks;
  const usage = prev.usage ?? { input_tokens: 0, output_tokens: 0 };
  let buffer = prev.buffer + chunk;

  let sep: number;
  while ((sep = buffer.indexOf('\n\n')) !== -1) {
    const frame = buffer.slice(0, sep);
    buffer = buffer.slice(sep + 2);

    const data = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('');
    if (!data || data === '[DONE]') continue;

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(data) as Record<string, unknown>;
    } catch {
      continue;
    }

    const type = payload.type;
    if (type === 'content_block_start') {
      const index = payload.index as number;
      const block = payload.content_block as { type?: string; id?: string; name?: string };
      if (block?.type === 'tool_use') {
        blocks[index] = { kind: 'tool_use', id: block.id ?? '', name: block.name ?? '', json: '' };
      } else {
        blocks[index] = { kind: 'text' };
      }
    } else if (type === 'content_block_delta') {
      const index = payload.index as number;
      const delta = payload.delta as { type?: string; text?: string; partial_json?: string };
      if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
        events.push({ type: 'text', text: delta.text });
      } else if (delta?.type === 'input_json_delta') {
        const block = blocks[index];
        if (block?.kind === 'tool_use') block.json += delta.partial_json ?? '';
      }
    } else if (type === 'content_block_stop') {
      const block = blocks[payload.index as number];
      if (block?.kind === 'tool_use') {
        let input: unknown = {};
        try {
          input = JSON.parse(block.json || '{}');
        } catch {
          input = {};
        }
        events.push({ type: 'tool_use', id: block.id, name: block.name, input });
      }
    } else if (type === 'message_start') {
      // Carries the prompt token count; no event, just accumulate usage.
      const message = payload.message as { usage?: { input_tokens?: number } } | undefined;
      if (typeof message?.usage?.input_tokens === 'number') {
        usage.input_tokens = message.usage.input_tokens;
      }
    } else if (type === 'message_delta') {
      const delta = payload.delta as { stop_reason?: string | null };
      const deltaUsage = payload.usage as { output_tokens?: number } | undefined;
      if (typeof deltaUsage?.output_tokens === 'number') {
        usage.output_tokens = deltaUsage.output_tokens;
      }
      const hasUsage = usage.input_tokens > 0 || usage.output_tokens > 0;
      events.push({
        type: 'stop',
        stopReason: delta?.stop_reason ?? null,
        ...(hasUsage ? { usage: { ...usage } } : {}),
      });
    }
    // `ping` and `message_stop` need no surfaced event.
  }

  return { events, state: { buffer, blocks, usage } };
}
