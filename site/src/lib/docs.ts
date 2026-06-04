import { getCollection, type CollectionEntry } from "astro:content";

export type DocEntry = CollectionEntry<"docs">;

export const docsNav = [
	{
		label: "Overview",
		items: [
			"index",
			"quickstart",
			"concepts",
			"tradeoffs",
			"limits",
		],
	},
	{
		label: "API",
		items: [
			"api/configuration",
			"api/search-overlay",
			"api/endpoint",
			"api/cli",
			"api/mcp",
			"api/knowledge-graph",
		],
	},
] as const;

export function getDocHref(id: string): string {
	return id === "index" ? "/docs" : `/docs/${id}`;
}

export async function getAllDocs(): Promise<DocEntry[]> {
	return getCollection("docs");
}

export async function getDocNavGroups() {
	const all = await getAllDocs();
	const byId = new Map(all.map((entry) => [entry.id, entry]));
	return docsNav.map((group) => ({
		label: group.label,
		items: group.items
			.map((id) => byId.get(id))
			.filter((entry): entry is DocEntry => Boolean(entry)),
	}));
}

export async function getDocSiblings(id: string) {
	const all = await getAllDocs();
	const byId = new Map(all.map((entry) => [entry.id, entry]));
	const ordered: string[] = docsNav.flatMap((group) => [...group.items]);
	const index = ordered.indexOf(id);
	const previous = index > 0 ? byId.get(ordered[index - 1]) : undefined;
	const next =
		index >= 0 && index < ordered.length - 1
			? byId.get(ordered[index + 1])
			: undefined;
	return { previous, next };
}

export async function getDocSearchIndex() {
	const all = await getAllDocs();
	return all.map((entry) => ({
		title: entry.data.title,
		description: entry.data.description,
		group: entry.data.group,
		href: getDocHref(entry.id),
		text: [entry.data.title, entry.data.description, entry.data.group].join(" "),
	}));
}
