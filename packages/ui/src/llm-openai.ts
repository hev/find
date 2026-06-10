// OpenAI-compatible Chat Completions client over fetch. One translation layer
// covers OpenAI, OpenRouter, and any Chat Completions-compatible endpoint: the
// rest of the package keeps speaking the internal (Anthropic-shaped) block
// types, and this module converts both ways. Like `llm.ts`, it stays free of
// runtime dependencies and edge-runtime friendly.

import type {
  AnthropicResponse,
  AnthropicTextBlock,
  AnthropicUsage,
  CallClaudeOptions,
  StreamEvent,
} from './llm.ts';

export interface OpenAiEndpoint {
  /** API base, e.g. `https://api.openai.com/v1` or `https://openrouter.ai/api/v1`. */
  baseUrl: string;
  /**
   * OpenAI's reasoning models reject `max_tokens` and want
   * `max_completion_tokens`; OpenRouter normalizes `max_tokens` for every
   * underlying provider.
   */
  tokenParam: 'max_tokens' | 'max_completion_tokens';
  /** Human label used in error messages, e.g. `OpenAI` or `OpenRouter`. */
  label: string;
}

interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}

function systemText(system: string | AnthropicTextBlock[]): string {
  // cache_control is Anthropic-specific; OpenAI-compatible APIs cache on their own.
  return typeof system === 'string' ? system : system.map((block) => block.text).join('\n\n');
}

/** Converts the internal (Anthropic-shaped) conversation into Chat Completions messages. */
export function toOpenAiMessages(opts: Pick<CallClaudeOptions, 'system' | 'messages'>): OpenAiMessage[] {
  const out: OpenAiMessage[] = [{ role: 'system', content: systemText(opts.system) }];

  for (const message of opts.messages) {
    if (typeof message.content === 'string') {
      out.push({ role: message.role, content: message.content });
      continue;
    }
    if (!Array.isArray(message.content)) continue;
    const blocks = message.content as Array<Record<string, unknown>>;

    if (message.role === 'assistant') {
      const text = blocks
        .filter((block) => block.type === 'text')
        .map((block) => String(block.text ?? ''))
        .join('');
      const toolCalls: OpenAiToolCall[] = blocks
        .filter((block) => block.type === 'tool_use')
        .map((block) => ({
          id: String(block.id ?? ''),
          type: 'function',
          function: { name: String(block.name ?? ''), arguments: JSON.stringify(block.input ?? {}) },
        }));
      out.push({
        role: 'assistant',
        content: text || null,
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      });
      continue;
    }

    // User turns: tool_result blocks must become role:"tool" messages directly
    // after the assistant turn that issued the calls; any text follows as a
    // plain user message.
    for (const block of blocks) {
      if (block.type !== 'tool_result') continue;
      out.push({
        role: 'tool',
        tool_call_id: String(block.tool_use_id ?? ''),
        content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? ''),
      });
    }
    const text = blocks
      .filter((block) => block.type === 'text')
      .map((block) => String(block.text ?? ''))
      .join('');
    if (text) out.push({ role: 'user', content: text });
  }

  return out;
}

/** Builds the full Chat Completions request body from internal call options. */
export function toOpenAiRequest(
  opts: CallClaudeOptions,
  endpoint: OpenAiEndpoint,
  stream: boolean,
): Record<string, unknown> {
  return {
    model: opts.model,
    [endpoint.tokenParam]: opts.maxTokens ?? 2048,
    messages: toOpenAiMessages(opts),
    ...(opts.tools?.length
      ? {
          tools: opts.tools.map((tool) => ({
            type: 'function',
            function: { name: tool.name, description: tool.description, parameters: tool.input_schema },
          })),
        }
      : {}),
    ...(opts.toolChoice
      ? {
          tool_choice:
            opts.toolChoice.type === 'tool'
              ? { type: 'function', function: { name: opts.toolChoice.name } }
              : 'auto',
        }
      : {}),
    ...(stream ? { stream: true, stream_options: { include_usage: true } } : {}),
  };
}

function mapStopReason(finishReason: string | null | undefined): string | null {
  if (finishReason === 'tool_calls') return 'tool_use';
  if (finishReason === 'stop') return 'end_turn';
  if (finishReason === 'length') return 'max_tokens';
  return finishReason ?? null;
}

function parseToolInput(args: string): unknown {
  try {
    return JSON.parse(args || '{}');
  } catch {
    return {};
  }
}

function mapUsage(usage: unknown): AnthropicUsage | undefined {
  const u = usage as { prompt_tokens?: number; completion_tokens?: number } | null | undefined;
  if (typeof u?.prompt_tokens !== 'number' && typeof u?.completion_tokens !== 'number') return undefined;
  return { input_tokens: u?.prompt_tokens ?? 0, output_tokens: u?.completion_tokens ?? 0 };
}

function requestInit(opts: CallClaudeOptions, endpoint: OpenAiEndpoint, stream: boolean): RequestInit {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify(toOpenAiRequest(opts, endpoint, stream)),
    signal: opts.signal,
  };
}

function completionsUrl(endpoint: OpenAiEndpoint): string {
  return `${endpoint.baseUrl.replace(/\/+$/, '')}/chat/completions`;
}

export async function callOpenAi(opts: CallClaudeOptions, endpoint: OpenAiEndpoint): Promise<AnthropicResponse> {
  const res = await fetch(completionsUrl(endpoint), requestInit(opts, endpoint, false));

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${endpoint.label} API ${res.status}: ${detail.slice(0, 500)}`);
  }

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: OpenAiToolCall[] }; finish_reason?: string | null }>;
    usage?: unknown;
  };
  const choice = payload.choices?.[0];
  const content: AnthropicResponse['content'] = [];
  if (choice?.message?.content) content.push({ type: 'text', text: choice.message.content });
  for (const call of choice?.message?.tool_calls ?? []) {
    content.push({ type: 'tool_use', id: call.id, name: call.function.name, input: parseToolInput(call.function.arguments) });
  }

  return {
    content,
    stop_reason: mapStopReason(choice?.finish_reason),
    ...(mapUsage(payload.usage) ? { usage: mapUsage(payload.usage) } : {}),
  };
}

/**
 * Streams a Chat Completions response, yielding text deltas as they arrive and
 * fully-reconstructed tool_use blocks (plus one `stop` event) at the end.
 */
export async function* streamOpenAi(opts: CallClaudeOptions, endpoint: OpenAiEndpoint): AsyncGenerator<StreamEvent> {
  const res = await fetch(completionsUrl(endpoint), requestInit(opts, endpoint, true));

  if (!res.ok || !res.body) {
    const detail = res.ok ? 'no response body' : await res.text().catch(() => '');
    throw new Error(`${endpoint.label} API ${res.status}: ${detail.slice(0, 500)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let state = newOpenAiSseState();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const out = parseOpenAiSseChunk(decoder.decode(value, { stream: true }), state);
    state = out.state;
    for (const event of out.events) yield event;
  }
  // Streams normally end with `data: [DONE]`; flush here in case one doesn't.
  for (const event of flushOpenAiSse(state)) yield event;
}

interface SseToolCall {
  id: string;
  name: string;
  args: string;
}

export interface OpenAiSseState {
  /** Bytes not yet terminated by a blank line. */
  buffer: string;
  /** Tool calls accumulated by their stream index. */
  toolCalls: Record<number, SseToolCall>;
  usage: AnthropicUsage;
  finishReason: string | null;
  /** Tool-use and stop events were already emitted (on `[DONE]`). */
  flushed: boolean;
}

export function newOpenAiSseState(): OpenAiSseState {
  return {
    buffer: '',
    toolCalls: {},
    usage: { input_tokens: 0, output_tokens: 0 },
    finishReason: null,
    flushed: false,
  };
}

/**
 * Pure, network-free Chat Completions SSE parser. Text deltas surface
 * immediately; tool calls and usage accumulate until `[DONE]` flushes them.
 */
export function parseOpenAiSseChunk(
  chunk: string,
  prev: OpenAiSseState,
): { events: StreamEvent[]; state: OpenAiSseState } {
  const events: StreamEvent[] = [];
  const state = { ...prev, toolCalls: prev.toolCalls, usage: prev.usage };
  state.buffer = prev.buffer + chunk;

  let sep: number;
  while ((sep = state.buffer.indexOf('\n\n')) !== -1) {
    const frame = state.buffer.slice(0, sep);
    state.buffer = state.buffer.slice(sep + 2);

    // Non-`data:` lines (OpenRouter emits `: PROCESSING` comments) are dropped.
    const data = frame
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('');
    if (!data) continue;
    if (data === '[DONE]') {
      events.push(...flushOpenAiSse(state));
      continue;
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(data) as Record<string, unknown>;
    } catch {
      continue;
    }

    const mappedUsage = mapUsage(payload.usage);
    if (mappedUsage) state.usage = mappedUsage;

    const choice = (payload.choices as Array<Record<string, unknown>> | undefined)?.[0];
    if (!choice) continue;
    if (typeof choice.finish_reason === 'string') state.finishReason = choice.finish_reason;

    const delta = choice.delta as
      | { content?: string | null; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> }
      | undefined;
    if (typeof delta?.content === 'string' && delta.content) {
      events.push({ type: 'text', text: delta.content });
    }
    for (const call of delta?.tool_calls ?? []) {
      const index = call.index ?? 0;
      const existing = state.toolCalls[index] ?? { id: '', name: '', args: '' };
      state.toolCalls[index] = {
        id: call.id ?? existing.id,
        name: existing.name + (call.function?.name ?? ''),
        args: existing.args + (call.function?.arguments ?? ''),
      };
    }
  }

  return { events, state };
}

/** Emits accumulated tool_use blocks and the final stop event, exactly once. */
export function flushOpenAiSse(state: OpenAiSseState): StreamEvent[] {
  if (state.flushed) return [];
  state.flushed = true;

  const events: StreamEvent[] = [];
  const indexes = Object.keys(state.toolCalls)
    .map(Number)
    .sort((a, b) => a - b);
  for (const index of indexes) {
    const call = state.toolCalls[index];
    events.push({ type: 'tool_use', id: call.id, name: call.name, input: parseToolInput(call.args) });
  }

  const hasUsage = state.usage.input_tokens > 0 || state.usage.output_tokens > 0;
  events.push({
    type: 'stop',
    stopReason: mapStopReason(state.finishReason),
    ...(hasUsage ? { usage: { ...state.usage } } : {}),
  });
  return events;
}
