// Minimal Anthropic Messages API client over fetch — keeps the package free of
// runtime dependencies and edge-runtime friendly.

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: unknown;
}

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface CallClaudeOptions {
  apiKey: string;
  model: string;
  system: string;
  messages: AnthropicMessage[];
  tools?: AnthropicTool[];
  toolChoice?: { type: 'tool'; name: string } | { type: 'auto' };
  maxTokens?: number;
}

export interface AnthropicResponse {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: unknown }
  >;
  stop_reason: string | null;
}

export async function callClaude(opts: CallClaudeOptions): Promise<AnthropicResponse> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 1024,
      system: opts.system,
      messages: opts.messages,
      tools: opts.tools,
      tool_choice: opts.toolChoice,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Anthropic API ${res.status}: ${detail.slice(0, 500)}`);
  }

  return (await res.json()) as AnthropicResponse;
}
