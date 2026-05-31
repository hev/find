import type { APIRoute } from "astro";
import { docsNav, getAllDocs, getDocHref } from "../lib/docs";

const SITE = "https://ask.hev.dev";

export const GET: APIRoute = async () => {
	const all = await getAllDocs();
	const byId = new Map(all.map((entry) => [entry.id, entry]));

	const parts: string[] = [];
	parts.push("# hev ask — full docs\n\n");
	parts.push(`> Concatenated docs surface. Index at ${SITE}/llms.txt.\n\n`);

	for (const group of docsNav) {
		for (const id of group.items) {
			const entry = byId.get(id);
			if (!entry) continue;
			const url = `${SITE}${getDocHref(id)}`;
			const body = entry.body?.trim() ?? "";
			parts.push(`---\n\n# ${entry.data.title}\n\n`);
			parts.push(`Source: ${url}\n\n`);
			parts.push(`${body}\n\n`);
		}
	}

	return new Response(parts.join(""), {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
};
