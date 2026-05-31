// Minimal, dependency-free, streaming-safe Markdown renderer for the AI answer.
//
// The renderer is fed the *whole* accumulated answer on every token, so partial
// syntax (an unterminated `[label](`) simply fails to match and renders as
// literal text until the closing token arrives — never a broken DOM. Model
// output is untrusted: the source text is HTML-escaped first, then our own
// trusted tags are injected. Links are validated against the grounding source
// set so a hallucinated URL degrades to plain text — and, when the source
// carries distinctive `terms`, a link whose surrounding text shares none of
// them (a misattributed citation) also degrades to plain text.

export interface Source {
  title: string;
  heading?: string;
  url: string;
  group?: string;
  /** Distinctive tokens of the cited section, for the link-support check. */
  terms?: string[];
}

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const CODE_RE = /`([^`]+)`/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;
const LIST_ITEM_RE = /^\s*(?:[-*]|\d+\.)\s+/;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Breadcrumb for a source, e.g. "Concepts › Kubernetes autoscaling". */
export function sourceBreadcrumb(source: Source): string {
  return [source.group, source.heading ?? source.title].filter(Boolean).join(' › ');
}

function tokenSet(text: string): Set<string> {
  // Strip link *targets* (keep labels) so a URL/anchor slug can't leak its own
  // terms into the support check — otherwise a link to #autoscaling would always
  // "support" itself via the word "autoscaling" in its href.
  const withoutUrls = text.replace(LINK_RE, (_m, label: string) => label);
  return new Set(withoutUrls.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

/**
 * A cited link survives only if the text around it shares a distinctive term
 * with the cited section. Lenient by design: a source with no `terms` (e.g. a
 * legacy/degraded graph) is never degraded on this basis.
 */
function supportsClaim(unitTokens: Set<string>, source: Source): boolean {
  if (!source.terms || source.terms.length === 0) return true;
  for (const term of source.terms) if (unitTokens.has(term)) return true;
  return false;
}

export function renderMarkdown(md: string, sources: Source[] = []): string {
  const urlMap = new Map(sources.map((source) => [source.url, source]));
  // Split into blocks on blank lines; render each as a list or a paragraph.
  return md
    .split(/\n{2,}/)
    .map((block) => renderBlock(block.trim(), urlMap))
    .filter(Boolean)
    .join('');
}

function renderBlock(block: string, urlMap: Map<string, Source>): string {
  if (!block) return '';
  // Horizontal rules and headings don't belong in a compact popover; the model
  // is told not to use them, but degrade them gracefully if it does.
  if (/^(-{3,}|\*{3,}|_{3,})$/.test(block)) return '';
  const heading = block.match(/^#{1,6}\s+(.+)$/);
  if (heading && !block.includes('\n')) {
    return `<p><strong>${renderInline(escapeHtml(heading[1]), urlMap, tokenSet(heading[1]))}</strong></p>`;
  }
  const lines = block.split('\n');
  if (lines.every((line) => !line.trim() || LIST_ITEM_RE.test(line))) {
    const items = lines.filter((line) => line.trim());
    const ordered = /^\s*\d+\./.test(items[0] ?? '');
    const tag = ordered ? 'ol' : 'ul';
    const body = items
      .map((line) => {
        const text = line.replace(LIST_ITEM_RE, '');
        return `<li>${renderInline(escapeHtml(text), urlMap, tokenSet(text))}</li>`;
      })
      .join('');
    return `<${tag}>${body}</${tag}>`;
  }
  const text = block.replace(/\n/g, ' ');
  return `<p>${renderInline(escapeHtml(text), urlMap, tokenSet(text))}</p>`;
}

function renderInline(escaped: string, urlMap: Map<string, Source>, unitTokens: Set<string>): string {
  // Order: code, then bold, then links. The source text is already escaped, so
  // injected tags are the only markup in the string.
  let out = escaped.replace(CODE_RE, (_m, code: string) => `<code>${code}</code>`);
  out = out.replace(BOLD_RE, (_m, inner: string) => `<strong>${inner}</strong>`);
  out = out.replace(LINK_RE, (whole, label: string, url: string) => {
    const source = urlMap.get(url);
    if (!source) return label; // hallucinated / off-corpus link → plain text
    if (!supportsClaim(unitTokens, source)) return label; // misattributed citation → plain text
    const title = escapeHtml(sourceBreadcrumb(source));
    return `<a class="as-answer-link" href="${escapeHtml(url)}" title="${title}">${label}</a>`;
  });
  return out;
}
