import type { APIRoute } from "astro";
import spec from "../../../packages/ui/openapi.yaml?raw";

export const prerender = true;

export const GET: APIRoute = () => {
	return new Response(spec, {
		headers: { "Content-Type": "application/yaml; charset=utf-8" },
	});
};
