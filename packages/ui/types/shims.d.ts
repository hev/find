// Ambient declarations used only for typechecking this package in isolation.
// These are NOT shipped (see package.json "files": ["src"]). In a consumer
// project the real `astro:content` types and the integration-provided virtual
// config module take over.

declare module 'astro:content' {
  export function getCollection(name: string): Promise<any[]>;
}

declare module 'virtual:agentic-search/config' {
  const config: {
    collections: string[] | null;
    model: string;
    basePath: string;
    maxResults: number;
    candidatePool: number;
    endpoint: string;
  };
  export default config;
}
