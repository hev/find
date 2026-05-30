// Minimal, dependency-free, streaming-safe Markdown renderer for the AI answer.
//
// The renderer is fed the *whole* accumulated answer on every token, so partial
// syntax (an unterminated `[label](`) simply fails to match and renders as
// literal text until the closing token arrives — never a broken DOM. Model
// output is untrusted: the source text is HTML-escaped first, then our own
// trusted tags are injected. Links are validated against the grounding source
// set so a hallucinated URL degrades to plain text.

export interface Source {
  title: string;
  heading?: string;
  url: string;
  group?: string;
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
  const lines = block.split('\n');
  if (lines.every((line) => !line.trim() || LIST_ITEM_RE.test(line))) {
    const items = lines.filter((line) => line.trim());
    const ordered = /^\s*\d+\./.test(items[0] ?? '');
    const tag = ordered ? 'ol' : 'ul';
    const body = items
      .map((line) => `<li>${renderInline(escapeHtml(line.replace(LIST_ITEM_RE, '')), urlMap)}</li>`)
      .join('');
    return `<${tag}>${body}</${tag}>`;
  }
  return `<p>${renderInline(escapeHtml(block.replace(/\n/g, ' ')), urlMap)}</p>`;
}

function renderInline(escaped: string, urlMap: Map<string, Source>): string {
  // Order: code, then bold, then links. The source text is already escaped, so
  // injected tags are the only markup in the string.
  let out = escaped.replace(CODE_RE, (_m, code: string) => `<code>${code}</code>`);
  out = out.replace(BOLD_RE, (_m, inner: string) => `<strong>${inner}</strong>`);
  out = out.replace(LINK_RE, (whole, label: string, url: string) => {
    const source = urlMap.get(url);
    if (!source) return label; // hallucinated / off-corpus link → plain text
    const title = escapeHtml(sourceBreadcrumb(source));
    return `<a class="as-answer-link" href="${escapeHtml(url)}" title="${title}">${label}</a>`;
  });
  return out;
}
