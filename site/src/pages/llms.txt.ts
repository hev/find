import type { APIRoute } from "astro";
import { docsNav, getAllDocs, getDocHref } from "../lib/docs";

const SITE = "https://askhev.com";

export const GET: APIRoute = async () => {
	const all = await getAllDocs();
	const byId = new Map(all.map((entry) => [entry.id, entry]));

	const lines: string[] = [];
	lines.push("# hev ask");
	lines.push("");
	lines.push("> A ⌘K search overlay for Astro docs sites.");
	lines.push("");
	lines.push(
		"hev ask is an Astro integration that adds instant keyword search over heading anchors, plus an optional Claude-powered agentic search loop on Enter. The corpus is your content collection; an offline-built, committed knowledge graph gives the loop domain context and a glossary.",
	);
	lines.push("");
	lines.push(`The full concatenated docs are at ${SITE}/llms-full.txt.`);
	lines.push("");

	for (const group of docsNav) {
		lines.push(`## ${group.label}`);
		for (const id of group.items) {
			const entry = byId.get(id);
			if (!entry) continue;
			const url = `${SITE}${getDocHref(id)}`;
			lines.push(`- [${entry.data.title}](${url}): ${entry.data.description}`);
		}
		lines.push("");
	}

	return new Response(lines.join("\n"), {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
};
