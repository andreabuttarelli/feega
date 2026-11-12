import { DARK, LIGHT, type DeclAt, type Declared } from './css-tokens';
import type { ReadFile } from './write-back';

export type TokenFile = { declared: Declared[]; skipped: string[] };

const TOKEN_FILES = ['tokens.json', 'design-tokens.json', 'src/tokens.json', 'src/design-tokens.json', 'tokens/tokens.json', 'tokens/light.tokens.json', 'tokens/dark.tokens.json'];
const STYLE_DICTIONARY_CONFIGS = ['config.json', 'sd.config.json', 'style-dictionary.config.json'];
const VALUE_KEY = /"\$value"\s*:/g;
const ALIAS = /^\{([^}]+)\}$/;
const GLOB = /[*?[{]/;
const DARK_FILE = /dark/i;
const MAX_FILE_BYTES = 512 * 1024;

type Group = Record<string, unknown>;

const isGroup = (v: unknown): v is Group => typeof v === 'object' && v !== null && !Array.isArray(v);

const cssName = (path: string[]) => `--${path.join('-')}`;

const RAW_OF: { test: (v: unknown) => boolean; raw: (v: unknown) => string }[] = [
  { test: (v) => typeof v === 'string' && ALIAS.test(v), raw: (v) => `var(${cssName(ALIAS.exec(v as string)![1].split('.'))})` },
  { test: (v) => typeof v === 'string' || typeof v === 'number', raw: (v) => String(v) },
  { test: (v) => Array.isArray(v) && v.every((x) => typeof x === 'string'), raw: (v) => (v as string[]).join(', ') },
  { test: (v) => isGroup(v) && typeof v.value === 'number' && typeof v.unit === 'string', raw: (v) => `${(v as Group).value}${(v as Group).unit}` }
];

type Found = { path: string[]; value: unknown; type?: string };

function walk(node: Group, path: string[], type: string | undefined, out: Found[]): void {
  const own = typeof node.$type === 'string' ? node.$type : type;
  if ('$value' in node) {
    out.push({ path, value: node.$value, type: own });
    return;
  }
  for (const [key, child] of Object.entries(node)) {
    if (!key.startsWith('$') && isGroup(child)) {
      walk(child, [...path, key], own, out);
    }
  }
}

function placeOf(text: string, file: string, offset: number): DeclAt {
  const before = text.slice(0, offset);
  const line = before.split('\n').length;
  return { file, line, column: offset - (before.lastIndexOf('\n') + 1) };
}

export function parseTokenFile(path: string, text: string): TokenFile {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return { declared: [], skipped: [`${path}: not valid JSON`] };
  }
  const found: Found[] = [];
  if (isGroup(root)) {
    walk(root, [], undefined, found);
  }
  const offsets = [...text.matchAll(VALUE_KEY)].map((m) => m.index!);
  const mode = DARK_FILE.test(path) ? DARK : LIGHT;
  const out: TokenFile = { declared: [], skipped: [] };
  found.forEach((token, i) => {
    const name = cssName(token.path);
    const reader = RAW_OF.find((r) => r.test(token.value));
    if (!reader || offsets[i] === undefined) {
      out.skipped.push(`${name}: a ${token.type ?? 'composite'} token is not a variable`);
      return;
    }
    out.declared.push({ name, raw: reader.raw(token.value), mode, at: placeOf(text, path, offsets[i]) });
  });
  return out;
}

async function configured(read: ReadFile): Promise<string[]> {
  const configs = await Promise.all(STYLE_DICTIONARY_CONFIGS.map((p) => read(p).catch(() => null)));
  return configs.flatMap((raw) => {
    try {
      const source = raw ? (JSON.parse(raw) as { source?: unknown }).source : undefined;
      return Array.isArray(source) ? source.filter((s): s is string => typeof s === 'string' && !GLOB.test(s)).map((s) => s.replace(/^\.\//, '')) : [];
    } catch {
      return [];
    }
  });
}

export async function readTokenFiles(read: ReadFile): Promise<TokenFile> {
  const paths = [...new Set([...TOKEN_FILES, ...(await configured(read))])];
  const out: TokenFile = { declared: [], skipped: [] };
  for (const path of paths) {
    const text = await read(path).catch(() => null);
    if (text === null || text.length > MAX_FILE_BYTES) {
      continue;
    }
    const file = parseTokenFile(path, text);
    out.declared.push(...file.declared);
    out.skipped.push(...file.skipped);
  }
  return out;
}
