// Inference provider registry. Anthropic keeps its native Messages client;
// OpenAI and OpenRouter share the Chat Completions client in `llm-openai.ts`,
// differing only in base URL, key env var, token param, and default models.

import { callClaude, streamClaude } from './llm.ts';
import { callOpenAi, streamOpenAi, type OpenAiEndpoint } from './llm-openai.ts';
import type { ProviderName } from './types.ts';

export type { ProviderName };

export interface ProviderInfo {
  name: ProviderName;
  /** Human label for log and error messages. */
  label: string;
  /** Environment variable the API key is read from. */
  envKey: string;
  /** Default API base URL (OpenAI-compatible providers only). */
  baseUrl?: string;
  /** Default model for the agentic search loop. */
  defaultModel: string;
  /** Default model for the offline digest builder. */
  defaultDigestModel: string;
}

export const PROVIDERS: Record<ProviderName, ProviderInfo> = {
  anthropic: {
    name: 'anthropic',
    label: 'Anthropic',
    envKey: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-haiku-4-5',
    defaultDigestModel: 'claude-opus-4-8',
  },
  openai: {
    name: 'openai',
    label: 'OpenAI',
    envKey: 'OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4.1-mini',
    defaultDigestModel: 'gpt-5.1',
  },
  openrouter: {
    name: 'openrouter',
    label: 'OpenRouter',
    envKey: 'OPENROUTER_API_KEY',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'anthropic/claude-haiku-4.5',
    defaultDigestModel: 'anthropic/claude-opus-4.8',
  },
};

/** Validates a configured provider name, defaulting to `anthropic`. */
export function resolveProviderName(value?: string): ProviderName {
  if (!value) return 'anthropic';
  if (value in PROVIDERS) return value as ProviderName;
  throw new Error(`Unknown provider "${value}". Expected one of: ${Object.keys(PROVIDERS).join(', ')}.`);
}

export interface LlmClient {
  call: typeof callClaude;
  stream: typeof streamClaude;
}

/**
 * Returns the call/stream pair for a provider. `baseUrl` overrides the
 * provider's API base, so any Chat Completions-compatible endpoint works.
 */
export function clientFor(provider: ProviderName, baseUrl?: string): LlmClient {
  if (provider === 'anthropic') return { call: callClaude, stream: streamClaude };

  const info = PROVIDERS[provider];
  const endpoint: OpenAiEndpoint = {
    baseUrl: baseUrl ?? info.baseUrl!,
    // OpenAI's reasoning models reject `max_tokens`; OpenRouter normalizes it.
    tokenParam: provider === 'openai' ? 'max_completion_tokens' : 'max_tokens',
    label: info.label,
  };
  return {
    call: (opts) => callOpenAi(opts, endpoint),
    stream: (opts) => streamOpenAi(opts, endpoint),
  };
}
