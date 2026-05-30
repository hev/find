export interface AgenticSearchOptions {
  /**
   * Content collection name(s) to index and search over.
   * @example ['docs']
   */
  collections?: string[];

  /**
   * Claude model used to rerank candidates and write result snippets.
   * Defaults to Haiku for speed.
   * @default 'claude-haiku-4-5'
   */
  model?: string;

  /**
   * The route the search endpoint is injected at.
   * @default '/api/agentic-search'
   */
  endpoint?: string;

  /**
   * Prefix used to turn a document slug into its page URL: `basePath + slug`.
   * @default '/docs/'
   */
  basePath?: string;

  /**
   * Maximum number of results returned to the overlay.
   * @default 6
   */
  maxResults?: number;

  /**
   * How many keyword-prefiltered candidates are handed to the model to rerank.
   * Larger pools improve recall at the cost of a few more input tokens.
   * @default 12
   */
  candidatePool?: number;
}

/** The shape the integration serializes into `virtual:agentic-search/config`. */
export interface ResolvedConfig {
  collections: string[] | null;
  model: string;
  endpoint: string;
  basePath: string;
  maxResults: number;
  candidatePool: number;
}
