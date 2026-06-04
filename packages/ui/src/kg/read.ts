import type { GlossaryEntry, KnowledgeGraph, KnowledgeNode } from './schema.ts';

export interface SectionSummary {
  id: string;
  title: string;
  heading: string | null;
  group: string | null;
  url: string;
}

export function listGlossary(kg: KnowledgeGraph): GlossaryEntry[] {
  return kg.glossary;
}

export function getGlossaryEntry(kg: KnowledgeGraph, term: string): GlossaryEntry | null {
  const needle = normalizeLookup(term);
  if (!needle) return null;
  return (
    kg.glossary.find((entry) => {
      if (normalizeLookup(entry.term) === needle) return true;
      return entry.aliases.some((alias) => normalizeLookup(alias) === needle);
    }) ?? null
  );
}

export function listSectionSummaries(kg: KnowledgeGraph, group?: string | null): SectionSummary[] {
  const wantedGroup = group ? normalizeLookup(group) : '';
  return kg.nodes
    .filter((node) => !wantedGroup || normalizeLookup(node.group ?? '') === wantedGroup)
    .map(sectionSummary);
}

export function getSection(kg: KnowledgeGraph, id: string): KnowledgeNode | null {
  const needle = decodePathValue(id).trim();
  if (!needle) return null;
  return kg.nodes.find((node) => node.id === needle) ?? null;
}

export function getOverview(kg: KnowledgeGraph): { overview: string; context: string } {
  return { overview: kg.overview, context: kg.context };
}

export function sectionSummary(node: KnowledgeNode): SectionSummary {
  return {
    id: node.id,
    title: node.title,
    heading: node.heading,
    group: node.group,
    url: node.url,
  };
}

export function decodePathValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeLookup(value: string): string {
  return decodePathValue(value).trim().toLowerCase();
}
