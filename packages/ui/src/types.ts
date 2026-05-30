export interface HevFindOptions {
  /**
   * Content collection name(s) to index and search over.
   * @example ['docs']
   */
  collections?: string[];

  /**
   * Claude model used by the bounded search loop.
   * @default 'claude-haiku-4-5'
   */
  model?: string;

  /**
   * The route the search endpoint is injected at.
   * @default '/api/find'
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
   * Model used by the offline knowledge graph builder.
   * @default 'claude-opus-4-8'
   */
  kgModel?: string;

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
   * Path to the committed knowledge graph artifact, relative to the site root.
   * @default '.hev-find/kg.json'
   */
  kgPath?: string;

  /**
   * Content globs used by the offline KG builder.
   * Defaults to Markdown/MDX files under each configured collection directory.
   */
  kgContentGlobs?: string[];
}

/** The shape the integration serializes into `virtual:hev-find/config`. */
export interface ResolvedConfig {
  collections: string[] | null;
  model: string;
  kgModel: string;
  endpoint: string;
  basePath: string;
  maxResults: number;
  maxIterations: number;
  chunkHeadingDepth: number;
  candidatePerSearch: number;
  perDocCap: number;
  kgPath: string;
  kgContentGlobs?: string[];
}
