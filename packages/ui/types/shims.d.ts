// Ambient declarations used only for typechecking this package in isolation.
// These are NOT shipped (see package.json "files": ["src"]). In a consumer
// project the real `astro:content` types and the integration-provided virtual
// config module take over.

declare module 'astro:content' {
  export function getCollection(name: string): Promise<any[]>;
}

declare module 'virtual:hev-find/config' {
  const config: {
    collections: string[] | null;
    model: string;
    kgModel: string;
    basePath: string;
    maxResults: number;
    maxIterations: number;
    chunkHeadingDepth: number;
    candidatePerSearch: number;
    perDocCap: number;
    kgPath: string;
    kgContentGlobs?: string[];
    endpoint: string;
  };
  export default config;
}

declare module 'virtual:hev-find/kg' {
  const kg: import('../src/kg/schema').KnowledgeGraph;
  export default kg;
}
