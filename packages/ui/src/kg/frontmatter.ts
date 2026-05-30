export interface FrontmatterDocument {
  data: Record<string, unknown>;
  body: string;
}

export function parseFrontmatter(src: string): FrontmatterDocument {
  if (!src.startsWith('---')) return { data: {}, body: src };
  const end = src.indexOf('\n---', 3);
  if (end === -1) return { data: {}, body: src };

  const raw = src.slice(3, end).trim();
  const body = src.slice(end).replace(/^\n---\s*\r?\n?/, '');
  return { data: parseFlatYaml(raw), body };
}

function parseFlatYaml(src: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const line of src.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const raw = trimmed.slice(colon + 1).trim();
    if (!key) continue;
    data[key] = parseScalar(raw);
  }
  return data;
}

function parseScalar(value: string): unknown {
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
