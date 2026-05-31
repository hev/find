#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import GithubSlugger from 'github-slugger';

const execFileAsync = promisify(execFile);
const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

async function main() {
const [command = 'build', ...args] = process.argv.slice(2);
const flags = parseFlags(args);

try {
  if (command === 'build') {
    const result = await buildKnowledgeGraph({
      siteRoot: process.cwd(),
      collections: flags.collections.length ? flags.collections : ['docs'],
      basePath: flags.basePath ?? '/docs/',
      kgPath: flags.kgPath ?? '.hev-find/kg.json',
      kgContentGlobs: flags.kgContentGlobs.length ? flags.kgContentGlobs : undefined,
      chunkHeadingDepth: flags.chunkHeadingDepth ?? 3,
      kgModel: flags.kgModel ?? 'claude-opus-4-8',
    });
    console.log(`[hev-find] kg:${result.status} ${result.path} (${result.chunks} chunks)`);
  } else if (command === 'verify') {
    const result = await verifyAnchors({
      siteRoot: process.cwd(),
      collections: flags.collections.length ? flags.collections : ['docs'],
      basePath: flags.basePath ?? '/docs/',
      kgPath: flags.kgPath ?? '.hev-find/kg.json',
      kgContentGlobs: flags.kgContentGlobs.length ? flags.kgContentGlobs : undefined,
      chunkHeadingDepth: flags.chunkHeadingDepth ?? 3,
      buildCommand: flags.buildCommand,
      skipBuild: flags.skipBuild,
    });

    let failed = false;

    if (result.missing.length) {
      for (const miss of result.missing) {
        console.error(`[hev-find] missing anchor ${miss.anchorId} for ${miss.url} in ${miss.file}`);
      }
      failed = true;
    }
    if (result.uncovered.length) {
      const sample = result.uncovered.slice(0, 5).join(', ');
      const more = result.uncovered.length > 5 ? `, …(+${result.uncovered.length - 5})` : '';
      console.warn(`[hev-find] ${result.uncovered.length} section(s) missing from the graph: ${sample}${more} — run \`hev-find-kg build\`.`);
      if (flags.strict) failed = true;
    }
    if (result.dropped.length) {
      console.warn(`[hev-find] ${result.dropped.length} source literal(s) dropped from agent-primary nodes — run \`hev-find-kg build\`:`);
      for (const drop of result.dropped.slice(0, 8)) console.warn(`  - ${drop.id}: ${drop.literal}`);
      if (flags.strict) failed = true;
    }

    if (failed) {
      process.exitCode = 1;
    } else {
      const warnings = result.dropped.length || result.uncovered.length ? ' (with warnings)' : '';
      console.log(`[hev-find] verified ${result.checked} anchors${warnings}`);
    }
  } else {
    console.error('Usage: hev-find-kg build|verify [--collection docs] [--base-path /docs/] [--strict]');
    process.exitCode = 1;
  }
} catch (err) {
  console.error(`[hev-find] ${err.message}`);
  process.exitCode = 1;
}
}

async function buildKnowledgeGraph(options) {
  const corpus = await buildCorpus(options);
  const outPath = path.resolve(options.siteRoot, options.kgPath);
  const existing = await readExistingKg(outPath);
  if (existing && existing.version === 2 && existing.contentHash === corpus.contentHash && existing.nodes.length > 0) {
    return { status: 'skipped', path: outPath, contentHash: corpus.contentHash, chunks: corpus.chunks.length };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required to build a fresh knowledge graph.');

  const corpusText = corpus.chunks
    .map((chunk) => {
      const title = chunk.heading ? `${chunk.docTitle} > ${chunk.heading}` : chunk.docTitle;
      return `id: ${chunk.id}\nurl: ${chunk.url}\ntitle: ${title}\n\n${chunk.text}`;
    })
    .join('\n\n---\n\n');

  const response = await callClaude({
    apiKey,
    model: options.kgModel,
    maxTokens: 8192,
    system: [
      {
        type: 'text',
        text:
          'You build documentation knowledge graphs for an AI search agent. Return only the forced tool call. Write a compact orientation, a glossary with aliases real users would type, and one tight summary for every section id in the corpus. Summaries are what the agent reasons from, so make them faithful and self-contained; paraphrase prose but never restate code, flags, or exact identifiers.',
      },
      {
        type: 'text',
        text: `<corpus>\n${corpusText}\n</corpus>`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: 'Emit the context, glossary, and one summary per section id. Every id in the corpus must get a summary.',
      },
    ],
    tools: [knowledgeGraphTool()],
    toolChoice: { type: 'tool', name: 'emit_knowledge_graph' },
  });

  const toolUse = response.content.find((block) => block.type === 'tool_use' && block.name === 'emit_knowledge_graph');
  const emitted = normalizeEmit(toolUse?.input);
  const summaryById = new Map(emitted.summaries.map((entry) => [entry.id, entry.summary]));

  const graph = {
    version: 2,
    generatedAt: new Date().toISOString(),
    contentHash: corpus.contentHash,
    context: emitted.context,
    glossary: emitted.glossary,
    overview: buildOverview(corpus.chunks),
    nodes: buildNodes(corpus.chunks, summaryById),
    edges: [],
  };

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(graph, null, 2) + '\n', 'utf8');
  return { status: 'built', path: outPath, contentHash: corpus.contentHash, chunks: corpus.chunks.length };
}

async function verifyAnchors(options) {
  if (!options.skipBuild) {
    await execFileAsync('sh', ['-c', options.buildCommand ?? 'pnpm build'], {
      cwd: options.siteRoot,
      maxBuffer: 1024 * 1024 * 8,
    });
  }

  const corpus = await buildCorpus(options);
  const distDir = path.resolve(options.siteRoot, options.distDir ?? 'dist');
  const anchored = corpus.chunks.filter((chunk) => chunk.anchorId);
  const missing = [];

  for (const chunk of anchored) {
    const files = htmlFilesForUrl(distDir, chunk.url);
    const found = await findHtmlWithId(files, chunk.anchorId);
    if (!found) missing.push({ url: chunk.url, file: files[0], anchorId: chunk.anchorId });
  }

  const { dropped, uncovered } = await verifyFidelity(options, corpus.chunks);
  return { checked: anchored.length, missing, dropped, uncovered };
}

async function verifyFidelity(options, chunks) {
  const kgPath = path.resolve(options.siteRoot, options.kgPath ?? '.hev-find/kg.json');
  const kg = await readExistingKg(kgPath);
  if (!kg || !kg.nodes.length) return { dropped: [], uncovered: [] };

  const nodeById = new Map(kg.nodes.map((node) => [node.id, node]));
  const dropped = [];
  const uncovered = [];

  for (const chunk of chunks) {
    const node = nodeById.get(chunk.id);
    if (!node) {
      uncovered.push(chunk.id);
      continue;
    }
    if (node.mode === 'source-primary') continue;
    const carried = new Set(node.facts.map((fact) => fact.literal));
    for (const fact of extractFacts(chunk.id, chunk.raw)) {
      if (!carried.has(fact.literal)) dropped.push({ id: chunk.id, literal: fact.literal });
    }
  }

  return { dropped, uncovered };
}

async function buildCorpus(options) {
  const files = await resolveContentFiles(options.siteRoot, options.collections, options.kgContentGlobs);
  const documents = await Promise.all(
    files.map(async (file) => {
      const raw = await readFile(file, 'utf8');
      const { data, body } = parseFrontmatter(raw);
      const slug = slugFromFile(options.siteRoot, file, options.collections);
      return {
        slug,
        title: typeof data.title === 'string' ? data.title : slug,
        group: typeof data.group === 'string' ? data.group : undefined,
        description: typeof data.description === 'string' ? data.description : undefined,
        body,
      };
    }),
  );

  const chunks = documents
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .flatMap((doc) => chunkDocument(doc, options.basePath, options.chunkHeadingDepth))
    .sort((a, b) => a.id.localeCompare(b.id));
  return { documents, chunks, contentHash: sha256(hashableChunkText(chunks)) };
}

function chunkDocument(doc, basePath, chunkHeadingDepth = 3) {
  const slugger = new GithubSlugger();
  const sections = [{ lines: [] }];
  let current = sections[0];
  const maxDepth = Math.max(2, Math.min(6, chunkHeadingDepth));

  for (const line of doc.body.split(/\r?\n/)) {
    const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) {
      current.lines.push(line);
      continue;
    }

    const level = match[1].length;
    const heading = cleanHeadingText(match[2]);
    const anchorId = slugger.slug(heading);

    if (level >= 2 && level <= maxDepth) {
      current = { heading, anchorId, lines: [line] };
      sections.push(current);
    } else {
      current.lines.push(line);
    }
  }

  return sections
    .map((section, index) => {
      const rawBody = section.lines.join('\n');
      const cleanedBody = cleanMarkdown(rawBody);
      const text = (index === 0 ? [doc.description, cleanedBody] : [cleanedBody]).filter(Boolean).join('\n').trim();
      if (!text && !section.heading) return null;
      const url = docSlugToUrl(doc.slug, basePath) + (section.anchorId ? `#${section.anchorId}` : '');
      return {
        id: section.anchorId ? `${doc.slug}#${section.anchorId}` : doc.slug,
        docSlug: doc.slug,
        docTitle: doc.title,
        group: doc.group,
        heading: section.heading,
        anchorId: section.anchorId,
        url,
        text,
        raw: rawBody,
      };
    })
    .filter(Boolean);
}

// --- Deterministic node + fact construction (mirrors src/kg/facts.ts, build.ts) ---

const FENCE_RE = /```[a-zA-Z0-9]*\n([\s\S]*?)```/g;
const INLINE_CODE_RE = /`([^`\n]+)`/g;
const FLAG_RE = /(?<![\w-])(--?[a-zA-Z][\w-]*)/g;
const VERSION_RE = /\bv?\d+(?:\.\d+)+\b/g;
const MODEL_ID_RE = /\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\d[a-z0-9-]*\b/gi;
const DOTTED_RE = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\b/gi;
const MAX_FACTS = 24;
const MAX_LITERAL = 400;

function extractFacts(chunkId, raw) {
  const seen = new Set();
  const facts = [];
  const push = (kind, literal) => {
    const value = literal.trim();
    if (value.length < 2 || value.length > MAX_LITERAL || seen.has(value)) return;
    seen.add(value);
    facts.push({ kind, literal: value, chunkId });
  };

  for (const match of raw.matchAll(FENCE_RE)) push('code', match[1]);
  const rest = raw.replace(FENCE_RE, ' ');
  for (const match of rest.matchAll(INLINE_CODE_RE)) push('code', match[1]);
  const bare = rest.replace(INLINE_CODE_RE, ' ');
  for (const match of bare.matchAll(FLAG_RE)) push('flag', match[1]);
  for (const match of bare.matchAll(MODEL_ID_RE)) push('value', match[0]);
  for (const match of bare.matchAll(DOTTED_RE)) push('value', match[0]);
  for (const match of bare.matchAll(VERSION_RE)) push('value', match[0]);

  return facts.slice(0, MAX_FACTS);
}

function classifyMode(group) {
  return group && /reference|api/i.test(group) ? 'source-primary' : 'agent-primary';
}

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'are', 'was', 'has', 'have', 'its',
  'use', 'used', 'using', 'can', 'will', 'when', 'where', 'how', 'what', 'which', 'each', 'all',
  'one', 'two', 'per', 'via', 'not', 'but', 'you', 'your', 'they', 'them', 'then', 'than', 'over',
]);

function tokenize(text) {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function distinctiveTokens(text, cap = 40) {
  const out = [];
  const seen = new Set();
  for (const token of tokenize(text)) {
    if (token.length < 4 || STOPWORDS.has(token) || seen.has(token)) continue;
    seen.add(token);
    out.push(token);
    if (out.length >= cap) break;
  }
  return out;
}

function buildNodes(chunks, summaryById) {
  return chunks
    .map((chunk) => {
      const facts = extractFacts(chunk.id, chunk.raw);
      const summary = (summaryById.get(chunk.id) ?? '').trim() || excerpt(chunk.text);
      const terms = distinctiveTokens(
        [chunk.heading ?? '', summary, facts.map((fact) => fact.literal).join(' '), chunk.text].join(' '),
      );
      return {
        id: chunk.id,
        kind: 'section',
        title: chunk.docTitle,
        heading: chunk.heading ?? null,
        group: chunk.group ?? null,
        url: chunk.url,
        summary,
        facts,
        sources: [{ chunkId: chunk.id, url: chunk.url, anchor: chunk.anchorId ?? null }],
        mode: classifyMode(chunk.group),
        terms,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function buildOverview(chunks) {
  const byGroup = new Map();
  for (const chunk of chunks) {
    const group = chunk.group ?? 'Docs';
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(chunk);
  }
  const lines = [];
  for (const [group, items] of [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`## ${group}`);
    for (const chunk of items) lines.push(`- ${chunk.heading ?? chunk.docTitle} — \`${chunk.id}\``);
  }
  return lines.join('\n');
}

function excerpt(text, max = 220) {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? trimmed.slice(0, max).trimEnd() + '…' : trimmed;
}

function cleanMarkdown(src) {
  return src
    .replace(/^\s*(import|export)\s.+$/gm, ' ')
    .replace(/```[a-zA-Z0-9]*\n?/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/^\s*\|?[\s:|-]{3,}\|?\s*$/gm, ' ')
    .replace(/\|/g, ' ')
    .replace(/^\s{0,3}#{1,6}\s+/gm, ' ')
    .replace(/^\s{0,3}>\s?/gm, ' ')
    .replace(/^\s{0,3}[-*+]\s+/gm, ' ')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanHeadingText(src) {
  return src
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<\/?[A-Za-z][^>]*>/g, ' ')
    .replace(/[*~]{1,3}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function docSlugToUrl(slug, basePath) {
  const base = basePath.endsWith('/') ? basePath : basePath + '/';
  if (slug === 'index') return base.replace(/\/$/, '') || '/';
  return base + slug.replace(/\/index$/, '');
}

function hashableChunkText(chunks) {
  return [...chunks]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((chunk) => `${chunk.id}\n${chunk.text}`)
    .join('\n---\n');
}

async function resolveContentFiles(siteRoot, collections, kgContentGlobs) {
  const collectionNames = collections?.length ? collections : ['docs'];
  const globs =
    kgContentGlobs?.length
      ? kgContentGlobs
      : collectionNames.map((collection) => `src/content/${collection}/**/*.{md,mdx}`);
  const files = new Set();
  for (const glob of globs) {
    for (const file of await filesForGlob(siteRoot, glob)) files.add(file);
  }
  return [...files].sort((a, b) => a.localeCompare(b));
}

async function filesForGlob(siteRoot, glob) {
  const normalized = glob.replace(/\\/g, '/');
  const root = path.resolve(siteRoot, globRoot(normalized));
  const all = await walk(root).catch(() => []);
  const re = globToRegex(normalized);
  return all.filter((file) => re.test(path.relative(siteRoot, file).replace(/\\/g, '/')));
}

function globRoot(glob) {
  const wildcard = glob.search(/[*{]/);
  if (wildcard === -1) return path.dirname(glob);
  const before = glob.slice(0, wildcard);
  return before.replace(/[/\\][^/\\]*$/, '') || '.';
}

function globToRegex(glob) {
  let pattern = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  pattern = pattern.replace(/\\\{([^}]+)\\\}/g, (_, inner) => `(${inner.split(',').map(escapeRegex).join('|')})`);
  pattern = pattern.replace(/\*\*\/?/g, '::GLOBSTAR::');
  pattern = pattern.replace(/\*/g, '[^/]*');
  pattern = pattern.replace(/::GLOBSTAR::/g, '(?:.*/)?');
  return new RegExp(`^${pattern}$`);
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const file = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(file) : [file];
    }),
  );
  return files.flat();
}

function slugFromFile(siteRoot, file, collections) {
  const normalizedFile = path.resolve(file);
  const collectionNames = collections?.length ? collections : ['docs'];
  for (const collection of collectionNames) {
    const root = path.resolve(siteRoot, 'src/content', collection);
    const rel = path.relative(root, normalizedFile);
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) return cleanSlug(rel);
  }
  return cleanSlug(path.relative(path.resolve(siteRoot, 'src/content'), normalizedFile));
}

function cleanSlug(rel) {
  return rel.replace(/\\/g, '/').replace(/\.(md|mdx)$/i, '').replace(/\/index$/, '');
}

function parseFrontmatter(src) {
  if (!src.startsWith('---')) return { data: {}, body: src };
  const end = src.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: src };
  const raw = src.slice(3, end).trim();
  const body = src.slice(end).replace(/^\n---\s*\r?\n?/, '');
  return { data: parseFlatYaml(raw), body };
}

function parseFlatYaml(src) {
  const data = {};
  for (const line of src.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    if (!key) continue;
    data[key] = parseScalar(trimmed.slice(colon + 1).trim());
  }
  return data;
}

function parseScalar(value) {
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === 'true') return true;
  if (value === 'false') return false;
  const numberValue = Number(value);
  if (Number.isFinite(numberValue) && /^-?\d+(\.\d+)?$/.test(value)) return numberValue;
  return value;
}

async function readExistingKg(file) {
  try {
    return normalizeKg(JSON.parse(await readFile(file, 'utf8')));
  } catch {
    return null;
  }
}

function normalizeKg(value) {
  if (!value || typeof value !== 'object') {
    return { version: 2, contentHash: '', context: '', glossary: [], nodes: [] };
  }
  return {
    version: 2,
    contentHash: typeof value.contentHash === 'string' ? value.contentHash : '',
    context: typeof value.context === 'string' ? value.context : '',
    glossary: Array.isArray(value.glossary)
      ? value.glossary
          .map((entry) => {
            if (!entry || typeof entry !== 'object' || typeof entry.term !== 'string') return null;
            return {
              term: entry.term,
              aliases: Array.isArray(entry.aliases) ? entry.aliases.filter((alias) => typeof alias === 'string') : [],
              definition: typeof entry.definition === 'string' ? entry.definition : '',
            };
          })
          .filter(Boolean)
      : [],
    nodes: Array.isArray(value.nodes)
      ? value.nodes
          .map((node) => {
            if (!node || typeof node !== 'object' || typeof node.id !== 'string') return null;
            return {
              id: node.id,
              mode: node.mode === 'source-primary' ? 'source-primary' : 'agent-primary',
              facts: Array.isArray(node.facts)
                ? node.facts.filter((fact) => fact && typeof fact.literal === 'string')
                : [],
            };
          })
          .filter(Boolean)
      : [],
  };
}

function normalizeEmit(value) {
  const base = normalizeKg(value);
  const summaries = Array.isArray(value?.summaries)
    ? value.summaries
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null;
          if (typeof entry.id !== 'string' || typeof entry.summary !== 'string') return null;
          return { id: entry.id, summary: entry.summary.trim() };
        })
        .filter(Boolean)
    : [];
  return { context: base.context, glossary: base.glossary, summaries };
}

function htmlFilesForUrl(distDir, url) {
  const pathname = url.split('#')[0].replace(/^\//, '').replace(/\/$/, '');
  return [path.join(distDir, pathname, 'index.html'), path.join(distDir, 'client', pathname, 'index.html')];
}

async function findHtmlWithId(files, id) {
  for (const file of files) {
    const html = await readFile(file, 'utf8').catch(() => '');
    if (html && hasId(html, id)) return true;
  }
  return false;
}

function hasId(html, id) {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\sid=(["'])${escaped}\\1`).test(html);
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

async function callClaude(opts) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': opts.apiKey,
      'anthropic-version': API_VERSION,
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4096,
      system: opts.system,
      messages: opts.messages,
      tools: opts.tools,
      tool_choice: opts.toolChoice,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return res.json();
}

function knowledgeGraphTool() {
  return {
    name: 'emit_knowledge_graph',
    description:
      'Emit a documentation knowledge graph: a compact orientation, a glossary, and one distilled summary per section.',
    input_schema: {
      type: 'object',
      properties: {
        context: { type: 'string' },
        glossary: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              term: { type: 'string' },
              aliases: { type: 'array', items: { type: 'string' } },
              definition: { type: 'string' },
            },
            required: ['term', 'aliases', 'definition'],
          },
        },
        summaries: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              summary: { type: 'string' },
            },
            required: ['id', 'summary'],
          },
        },
      },
      required: ['context', 'glossary', 'summaries'],
    },
  };
}

function parseFlags(args) {
  const flags = { collections: [], kgContentGlobs: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];
    if (arg === '--collection' && next) {
      flags.collections.push(next);
      i += 1;
    } else if (arg === '--base-path' && next) {
      flags.basePath = next;
      i += 1;
    } else if (arg === '--kg-path' && next) {
      flags.kgPath = next;
      i += 1;
    } else if (arg === '--content-glob' && next) {
      flags.kgContentGlobs.push(next);
      i += 1;
    } else if (arg === '--chunk-heading-depth' && next) {
      flags.chunkHeadingDepth = Number(next);
      i += 1;
    } else if (arg === '--kg-model' && next) {
      flags.kgModel = next;
      i += 1;
    } else if (arg === '--build-command' && next) {
      flags.buildCommand = next;
      i += 1;
    } else if (arg === '--skip-build') {
      flags.skipBuild = true;
    } else if (arg === '--strict') {
      flags.strict = true;
    }
  }
  return flags;
}

// Run last, after every const/function above is initialized. The entry uses
// top-level await, which suspends module evaluation — so calling it from the
// top would invoke fact-extraction (FENCE_RE et al.) before those consts exist.
await main();
