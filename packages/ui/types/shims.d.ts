// Ambient declarations used only for typechecking this package in isolation.
// These are NOT shipped (see package.json "files": ["src"]). In a consumer
// project the real `astro:content` types and the integration-provided virtual
// config module take over.

declare module 'astro:content' {
  export function getCollection(name: string): Promise<any[]>;
}

declare module 'virtual:hev-ask/config' {
  const config: {
    collections: string[] | null;
    provider?: 'anthropic' | 'openai' | 'openrouter';
    providerBaseUrl?: string;
    model: string;
    digestModel: string;
    basePath: string;
    maxResults: number;
    answerMaxTokens: number;
    maxIterations: number;
    chunkHeadingDepth: number;
    candidatePerSearch: number;
    perDocCap: number;
    digestDir?: string;
    digestPath: string;
    digestContentGlobs?: string[];
    endpoint: string;
  };
  export default config;
}

declare module 'virtual:hev-ask/digest' {
  const digest: import('../src/digest/schema').Digest;
  export default digest;
}
