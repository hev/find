/** Inference providers the search loop and digest builder can run against. */
export type ProviderName = 'anthropic' | 'openai' | 'openrouter';

export interface HevAskOptions {
  /**
   * Content collection name(s) to index and search over.
   * @example ['docs']
   */
  collections?: string[];

  /**
   * Inference provider for the agentic loop and the digest builder. Each
   * provider reads its own key from the environment: `ANTHROPIC_API_KEY`,
   * `OPENAI_API_KEY`, or `OPENROUTER_API_KEY`.
   * @default 'anthropic'
   */
  provider?: ProviderName;

  /**
   * Override the provider's API base URL. Applies to the OpenAI-compatible
   * providers only, so any Chat Completions-compatible endpoint works
   * (e.g. a proxy or a self-hosted gateway).
   */
  providerBaseUrl?: string;

  /**
   * Model used by the bounded search loop. Defaults per provider:
   * `claude-haiku-4-5` (anthropic), `gpt-4.1-mini` (openai),
   * `anthropic/claude-haiku-4.5` (openrouter).
   */
  model?: string;

  /**
   * The route the search endpoint is injected at.
   * @default '/api/ask'
   */
  endpoint?: string;

  /**
   * Prefix used to turn a document slug into its page URL: `basePath + slug`.
   * @default '/docs/'
   */
  basePath?: string;

  /**
   * Maximum number of source sections the AI answer may ground in and cite
   * (also the size of the Sources footer). Keyword mode uses it as the result
   * row cap.
   * @default 6
   */
  maxResults?: number;

  /**
   * Token budget for the streamed AI answer.
   * @default 1024
   */
  answerMaxTokens?: number;

  /**
   * Model used by the offline digest builder. Defaults per provider:
   * `claude-opus-4-8` (anthropic), `gpt-5.1` (openai),
   * `anthropic/claude-opus-4.8` (openrouter).
   */
  digestModel?: string;

  /**
   * Maximum search tool rounds the model can run before it must present results.
   * @default 4
   */
  maxIterations?: number;

  /**
   * Highest Markdown heading level used as a chunk boundary.
   * `2` chunks at `##`; `3` chunks at `##` and `###`.
   * @default 3
   */
  chunkHeadingDepth?: number;

  /**
   * Chunks returned by each search tool call.
   * @default 8
   */
  candidatePerSearch?: number;

  /**
   * Maximum chunks from the same document returned by one prefilter call.
   * @default 2
   */
  perDocCap?: number;

  /**
   * Path to the committed ask digest tree, relative to the site root.
   * @default '.hev-ask'
   */
  digestDir?: string;

  /**
   * Deprecated alias for `digestDir`.
   * @default '.hev-ask'
   */
  digestPath?: string;

  /**
   * Content globs used by the offline digest builder.
   * Defaults to Markdown/MDX files under each configured collection directory.
   */
  digestContentGlobs?: string[];
}

/** The shape the integration serializes into `virtual:hev-ask/config`. */
export interface ResolvedConfig {
  collections: string[] | null;
  provider: ProviderName;
  providerBaseUrl?: string;
  model: string;
  digestModel: string;
  endpoint: string;
  basePath: string;
  maxResults: number;
  answerMaxTokens: number;
  maxIterations: number;
  chunkHeadingDepth: number;
  candidatePerSearch: number;
  perDocCap: number;
  digestPath: string;
  digestContentGlobs?: string[];
}
