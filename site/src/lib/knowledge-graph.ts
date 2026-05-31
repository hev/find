import kgRaw from "../../.hev-ask/kg.json?raw";

export interface GlossaryTerm {
	term: string;
	aliases?: string[];
	definition: string;
}

export interface KgFact {
	kind: "code" | "flag" | "value" | string;
	literal: string;
	chunkId: string;
}

export interface KgNode {
	id: string;
	kind: string;
	title: string;
	heading: string | null;
	group: string | null;
	url: string;
	summary: string;
	facts: KgFact[];
	mode: "agent-primary" | "source-primary";
	terms: string[];
}

export interface KnowledgeGraph {
	version: number;
	generatedAt: string;
	contentHash: string;
	context: string;
	glossary: GlossaryTerm[];
	overview: string;
	nodes: KgNode[];
}

export const knowledgeGraph = JSON.parse(kgRaw) as KnowledgeGraph;

export const knowledgeGraphHref = "/kg";

/** Nodes grouped by their docs group, preserving id order within a group. */
export function nodesByGroup(): { group: string; nodes: KgNode[] }[] {
	const map = new Map<string, KgNode[]>();
	for (const node of knowledgeGraph.nodes ?? []) {
		const group = node.group ?? "Docs";
		if (!map.has(group)) map.set(group, []);
		map.get(group)!.push(node);
	}
	return [...map.entries()]
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([group, nodes]) => ({ group, nodes }));
}

export function getKnowledgeGraphRawJson() {
	return JSON.stringify(knowledgeGraph, null, 2);
}

export function formatGeneratedAt() {
	const date = new Date(knowledgeGraph.generatedAt);
	return Number.isNaN(date.getTime()) ? knowledgeGraph.generatedAt || "—" : date.toISOString();
}
