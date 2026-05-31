#!/usr/bin/env node
// Ingest turbopuffer's published docs corpus into an Astro content collection.
//
// turbopuffer serves the whole docs set as one markdown file at /llms-full.txt
// (the machine-readable format they publish on purpose). Each page is wrapped
// in an XML-style tag whose name is the page slug, e.g.:
//
//   <architecture>
//   # Architecture
//   ...content...
//   </architecture>
//
// We fetch that file once and split on those tags — no HTML crawling.
//
//   node scripts/ingest.mjs            # dry run: fetch, split, print plan
//   node scripts/ingest.mjs --write    # write src/content/docs/*.md
import { mkdir, writeFile, rm, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WRITE = process.argv.includes('--write');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../src/content/docs');
const SOURCE = 'https://turbopuffer.com/llms-full.txt';
const CACHE = '/tmp/tpuf-llms-full.txt';

// Nav grouping, from the turbopuffer sidebar (llms.txt sections).
const GROUP = {
  index: 'Overview', overview: 'API',
  architecture: 'Concepts', concepts: 'Concepts', guarantees: 'Concepts',
  tradeoffs: 'Concepts', limits: 'Concepts', regions: 'Concepts', roadmap: 'Concepts',
  security: 'Operations', cmek: 'Operations', 'private-networking': 'Operations',
  'audit-logs': 'Operations', backups: 'Operations', performance: 'Operations',
  pinning: 'Operations', branching: 'Operations', enterprise: 'Operations', vdp: 'Operations',
  byoc: 'Operations', deployment: 'Operations', configuration: 'Operations',
  'control-plane': 'Operations', operations: 'Operations', requirements: 'Operations',
  quickstart: 'Guides', vector: 'Guides', fts: 'Guides', hybrid: 'Guides',
  chunking: 'Guides', testing: 'Guides', permissions: 'Guides',
  write: 'API', query: 'API', metadata: 'API', namespaces: 'API',
  export: 'API', 'warm-cache': 'API', 'delete-namespace': 'API', recall: 'API',
  'pricing-log': 'API',
};

async function load() {
  try {
    const cached = await readFile(CACHE, 'utf8');
    if (cached.length > 1000) return cached;
  } catch {}
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`fetch ${SOURCE} -> ${res.status}`);
  return res.text();
}

const raw = await load();
const lines = raw.split('\n');

// Split into pages on <slug> ... </slug> tags. Flat state machine: turbopuffer's
// format is one tag per page, no nesting.
const pages = [];
let cur = null;
for (const line of lines) {
  const open = line.match(/^<([a-z0-9][a-z0-9_-]*)>\s*$/);
  const close = line.match(/^<\/([a-z0-9][a-z0-9_-]*)>\s*$/);
  if (!cur && open) {
    cur = { slug: open[1], body: [] };
  } else if (cur && close && close[1] === cur.slug) {
    pages.push(cur);
    cur = null;
  } else if (cur) {
    cur.body.push(line);
  }
}
if (cur) pages.push(cur); // unterminated final page

const docs = pages.map((p) => {
  let body = p.body.join('\n').trim();
  // First line is the page's `# Title`; lift it into frontmatter and drop it
  // from the body so the layout renders the title once.
  const h1 = body.match(/^#\s+(.+)\s*$/m);
  const title = h1 ? h1[1].trim() : p.slug;
  body = body.replace(/^#\s+.+\r?\n+/, '').trim();
  // Description: first prose paragraph (skip code fences, diagrams, blockquotes).
  const desc = (body.split(/\n\s*\n/).map((s) => s.trim())
    .find((s) => /^[A-Za-z]/.test(s) && !s.startsWith('```')) || title)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[`*_>#]/g, '')
    .replace(/\s+/g, ' ').slice(0, 150).trim();
  return { slug: p.slug, title, group: GROUP[p.slug] || 'Reference', desc, body, bytes: body.length };
});

const totalBytes = docs.reduce((n, d) => n + d.bytes, 0);
console.log(`source ${raw.length} bytes -> ${docs.length} pages, ${totalBytes} body bytes`);
const byGroup = {};
for (const d of docs) (byGroup[d.group] ??= []).push(d.slug);
for (const [g, ss] of Object.entries(byGroup)) console.log(`  [${g}] (${ss.length}): ${ss.join(', ')}`);
console.log('\npages by size:');
for (const d of [...docs].sort((a, b) => b.bytes - a.bytes)) {
  console.log(`  ${d.slug.padEnd(20)} ${String(d.bytes).padStart(7)}b  ${d.title}`);
}

if (!WRITE) {
  console.log('\n(dry run — pass --write to emit files)');
} else {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });
  for (const d of docs) {
    const fm = `---\ntitle: ${JSON.stringify(d.title)}\ndescription: ${JSON.stringify(d.desc)}\ngroup: ${JSON.stringify(d.group)}\n---\n\n${d.body}\n`;
    await writeFile(path.join(OUT, `${d.slug}.md`), fm, 'utf8');
  }
  const written = (await readdir(OUT)).filter((f) => f.endsWith('.md'));
  console.log(`\nwrote ${written.length} files to ${path.relative(process.cwd(), OUT)}`);
}
