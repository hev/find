// PostHog LLM observability for the agentic answer path.
//
// Emits $ai_generation / $ai_span / $ai_trace events over `fetch` so each
// request shows up in PostHog's LLM analytics with model, token, latency, and
// trace structure. Like `llm.ts`, this stays free of runtime dependencies and
// edge-runtime friendly — it speaks PostHog's capture API directly rather than
// pulling in `posthog-node`. Mirrors the pattern used in ../mind
// (site/src/lib/agent-core.mjs).
//
// Everything degrades: with no PostHog key configured, `makeTelemetry` returns
// a no-op sink, so the agentic path behaves exactly as before.

import type { AnthropicUsage } from './llm.ts';

/**
 * How much prompt/response text ships to PostHog.
 * - `off`: metadata only (model, tokens, latency, tool names). No text.
 * - `redacted`: conversation + tool calls, but tool_result bodies are redacted.
 * - `full` (default): everything. The corpus is public docs, so this is safe.
 */
export type CaptureMode = 'off' | 'redacted' | 'full';

export interface GenerationEvent {
  spanId: string;
  spanName: string;
  model: string;
  input: unknown;
  output: unknown;
  usage?: AnthropicUsage;
  latencyMs: number;
  httpStatus?: number;
}

export interface SpanEvent {
  spanId: string;
  parentId?: string;
  name: string;
  input?: unknown;
  output?: unknown;
  ok: boolean;
  latencyMs: number;
}

export interface TraceEvent {
  name?: string;
  latencyMs: number;
  ok: boolean;
}

/** A telemetry sink. The no-op variant has the same shape so callers never branch. */
export interface Telemetry {
  readonly traceId: string;
  generation(event: GenerationEvent): void;
  span(event: SpanEvent): void;
  trace(event: TraceEvent): void;
}

export interface TelemetryOptions {
  /** PostHog project API key. Absent → telemetry is a no-op. */
  apiKey?: string;
  /** Ingestion host; defaults to PostHog US cloud. */
  host?: string;
  /** Content capture level; defaults to `full`. */
  captureContent?: CaptureMode;
  /** Distinct id for the person/session; defaults to `anonymous`. */
  distinctId?: string;
  /** Optional label attached to every event as `agent_scope`. */
  scope?: string;
  /** Inference provider reported as `$ai_provider`; defaults to `anthropic`. */
  provider?: string;
  /** Reuse an existing trace id; one is generated otherwise. */
  traceId?: string;
  /** Cloudflare-style keep-alive so in-flight captures survive response end. */
  waitUntil?: (promise: Promise<unknown>) => void;
  /** Injectable for tests / non-standard runtimes. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests. */
  randomId?: () => string;
}

function defaultRandomId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  return c?.randomUUID ? c.randomUUID() : `trace-${Date.now()}`;
}

function noopTelemetry(traceId: string): Telemetry {
  return {
    traceId,
    generation() {},
    span() {},
    trace() {},
  };
}

/**
 * Build a telemetry sink from explicit options. Returns a no-op sink when no
 * PostHog key is set so the agentic path degrades gracefully.
 */
export function makeTelemetry(options: TelemetryOptions = {}): Telemetry {
  const randomId = options.randomId ?? defaultRandomId;
  const traceId = options.traceId ?? randomId();
  const { apiKey } = options;
  if (!apiKey) return noopTelemetry(traceId);

  const host = (options.host ?? 'https://us.i.posthog.com').replace(/\/+$/, '');
  const mode: CaptureMode = options.captureContent ?? 'full';
  const distinctId = options.distinctId ?? 'anonymous';
  const fetchImpl = options.fetchImpl ?? fetch;
  const { waitUntil, scope } = options;

  const emit = (event: string, properties: Record<string, unknown>) => {
    const body = JSON.stringify({
      api_key: apiKey,
      event,
      distinct_id: distinctId,
      properties: {
        $ai_trace_id: traceId,
        $ai_provider: options.provider ?? 'anthropic',
        $process_person_profile: false, // anonymous — no person profile
        ...(scope ? { agent_scope: scope } : {}),
        ...properties,
      },
    });
    const sent = fetchImpl(`${host}/i/v0/e/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })
      .then(() => undefined)
      .catch(() => undefined);
    if (waitUntil) waitUntil(sent);
  };

  // For `redacted`, blank out tool_result bodies (the injected document text)
  // while keeping the conversation and tool calls intact.
  const redact = (input: unknown): unknown => {
    if (mode === 'full' || !Array.isArray(input)) return input;
    return input.map((message) => {
      const content = (message as { content?: unknown })?.content;
      if (!Array.isArray(content)) return message;
      return {
        ...(message as object),
        content: content.map((block) =>
          (block as { type?: string })?.type === 'tool_result'
            ? { ...(block as object), content: '[redacted]' }
            : block,
        ),
      };
    });
  };

  return {
    traceId,
    generation({ spanId, spanName, model, input, output, usage, latencyMs, httpStatus }) {
      const props: Record<string, unknown> = {
        $ai_span_id: spanId,
        $ai_span_name: spanName,
        $ai_model: model,
        $ai_input_tokens: usage?.input_tokens ?? 0,
        $ai_output_tokens: usage?.output_tokens ?? 0,
        $ai_latency: latencyMs / 1000,
      };
      if (httpStatus !== undefined) {
        props.$ai_http_status = httpStatus;
        props.$ai_is_error = httpStatus >= 400;
      }
      if (mode !== 'off') {
        props.$ai_input = redact(input);
        props.$ai_output_choices = [{ role: 'assistant', content: output }];
      }
      emit('$ai_generation', props);
    },
    span({ spanId, parentId, name, input, output, ok, latencyMs }) {
      const props: Record<string, unknown> = {
        $ai_span_id: spanId,
        $ai_span_name: name,
        $ai_latency: latencyMs / 1000,
        $ai_is_error: !ok,
      };
      if (parentId) props.$ai_parent_id = parentId;
      if (mode !== 'off') {
        if (input !== undefined) props.$ai_input_state = input;
        if (output !== undefined) props.$ai_output_state = output;
      }
      emit('$ai_span', props);
    },
    trace({ name, latencyMs, ok }) {
      emit('$ai_trace', {
        $ai_span_name: name ?? 'hev ask agent',
        $ai_latency: latencyMs / 1000,
        $ai_is_error: !ok,
      });
    },
  };
}

/**
 * Read telemetry options from environment variables. `POSTHOG_KEY` (or
 * `POSTHOG_API_KEY`) enables capture; both are checked so this slots into
 * existing PostHog setups. `overrides` win over the environment.
 */
export function telemetryFromEnv(
  env: Record<string, string | undefined> = process.env,
  overrides: Partial<TelemetryOptions> = {},
): TelemetryOptions {
  const raw = env.POSTHOG_CAPTURE_CONTENT?.toLowerCase();
  const captureContent =
    raw === 'off' || raw === 'redacted' || raw === 'full' ? (raw as CaptureMode) : undefined;
  return {
    apiKey: env.POSTHOG_KEY ?? env.POSTHOG_API_KEY,
    host: env.POSTHOG_HOST,
    captureContent,
    ...overrides,
  };
}
