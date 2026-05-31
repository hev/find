import { tokenize } from '../search/chunk.ts';
import type { Fact } from './schema.ts';

const FENCE_RE = /```[a-zA-Z0-9]*\n([\s\S]*?)```/g;
const INLINE_CODE_RE = /`([^`\n]+)`/g;
const FLAG_RE = /(?<![\w-])(--?[a-zA-Z][\w-]*)/g;
const VERSION_RE = /\bv?\d+(?:\.\d+)+\b/g;
const MODEL_ID_RE = /\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\d[a-z0-9-]*\b/gi;
const DOTTED_RE = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/gi;

const MAX_FACTS = 24;
const MAX_LITERAL = 400;

/**
 * Extracts byte-verbatim literals (code, flags, identifiers, versions) from a
 * section's raw markdown. These are the answer-critical strings the prose
 * tokenizer destroys; they are carried into the KG node unchanged so the agent
 * can quote them exactly without re-reading the source.
 *
 * Fully deterministic — the model never authors or edits a fact.
 */
export function extractFacts(chunkId: string, raw: string): Fact[] {
  const seen = new Set<string>();
  const facts: Fact[] = [];
  const push = (kind: Fact['kind'], literal: string) => {
    const value = literal.trim();
    if (value.length < 2 || value.length > MAX_LITERAL || seen.has(value)) return;
    seen.add(value);
    facts.push({ kind, literal: value, chunkId });
  };

  // Fenced code blocks first, then strip them so inline scanners don't re-read them.
  let rest = raw;
  for (const match of raw.matchAll(FENCE_RE)) push('code', match[1]);
  rest = rest.replace(FENCE_RE, ' ');

  for (const match of rest.matchAll(INLINE_CODE_RE)) push('code', match[1]);
  // Inline code is the richest source of exact tokens; scan the remainder for
  // bare flags/identifiers/versions that weren't wrapped in backticks.
  const bare = rest.replace(INLINE_CODE_RE, ' ');
  for (const match of bare.matchAll(FLAG_RE)) push('flag', match[1]);
  for (const match of bare.matchAll(MODEL_ID_RE)) push('value', match[0]);
  for (const match of bare.matchAll(DOTTED_RE)) push('value', match[0]);
  for (const match of bare.matchAll(VERSION_RE)) push('value', match[0]);

  return facts.slice(0, MAX_FACTS);
}

/** Sections in these groups carry dense literals the agent should read verbatim. */
const SOURCE_PRIMARY_GROUP_RE = /reference|api/i;

export function classifyMode(group: string | undefined | null): 'agent-primary' | 'source-primary' {
  return group && SOURCE_PRIMARY_GROUP_RE.test(group) ? 'source-primary' : 'agent-primary';
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'are', 'was', 'has', 'have', 'its',
  'use', 'used', 'using', 'can', 'will', 'when', 'where', 'how', 'what', 'which', 'each', 'all',
  'one', 'two', 'per', 'via', 'not', 'but', 'you', 'your', 'they', 'them', 'then', 'than', 'over',
]);

/**
 * Distinctive tokens for the render-time link-support check: tokens long enough
 * to be meaningful, minus common words. A cited link survives only if the
 * answer block that contains it shares one of these with the cited node.
 */
export function distinctiveTokens(text: string, cap = 40): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const token of tokenize(text)) {
    if (token.length < 4 || STOPWORDS.has(token) || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= cap) break;
  }
  return out;
}
