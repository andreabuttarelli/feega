import { posix } from 'node:path';

export type ReadSource = (path: string) => Promise<string | null>;

const SPECIFIER = /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(?\s*['"]([^'"]+)['"]/g;
const ALIASES = ['@/', '~/'];
const EXTENSIONS = ['', '.tsx', '.ts', '.jsx', '.js', '/index.tsx', '/index.ts', '/index.jsx', '/index.js'];
const MAX_FILES = 500;

const specifiersOf = (source: string) => [...source.matchAll(SPECIFIER)].map((m) => m[1] ?? m[2]);

function baseOf(from: string, specifier: string): string | null {
  const alias = ALIASES.find((a) => specifier.startsWith(a));
  if (alias) {
    return specifier.slice(alias.length);
  }
  if (specifier.startsWith('.')) {
    return posix.normalize(posix.join(posix.dirname(from), specifier));
  }
  return null;
}

async function resolved(base: string, read: ReadSource): Promise<{ path: string; source: string } | null> {
  for (const ext of EXTENSIONS) {
    const source = await read(base + ext);
    if (source !== null) {
      return { path: base + ext, source };
    }
  }
  return null;
}

export async function importGraph(entry: string, read: ReadSource): Promise<string[]> {
  const first = await read(entry);
  if (first === null) {
    return [];
  }

  const seen = new Map<string, string>([[entry, first]]);
  const queue = [entry];
  while (queue.length && seen.size < MAX_FILES) {
    const from = queue.shift()!;
    for (const specifier of specifiersOf(seen.get(from)!)) {
      const base = baseOf(from, specifier);
      if (base === null) {
        continue;
      }
      const found = await resolved(base, read);
      if (!found || seen.has(found.path)) {
        continue;
      }
      seen.set(found.path, found.source);
      queue.push(found.path);
    }
  }
  return [...seen.keys()];
}
