import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, normalize, relative, sep } from 'node:path';
import { UNRESOLVED, valueAt, type Lookup, type Resolved } from './expression-value';
import { ALIASES } from './usages';

const MAX_DEPTH = 5;
const SCRIPT_BLOCK = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;
const IMPORT = /import\s+(?:type\s+)?([^'";]+?)\s+from\s*['"]([^'"]+)['"]/g;
const DEFAULT_EXPORT = /export\s+default\s+/;
const CANDIDATES = ['', '.ts', '.js', '.mjs', '.json', '/index.ts', '/index.js'];
const JSON_FILE = /\.json$/;
const SCRIPTED = /\.(svelte|vue)$/;
const ASTRO = /\.astro$/;
const DEFAULT_NAME = 'default';

export const escaped = (name: string) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function scriptOf(file: string, text: string): string {
  if (SCRIPTED.test(file)) {
    return [...text.matchAll(SCRIPT_BLOCK)].map((match) => match[1]).join('\n');
  }

  return ASTRO.test(file) ? (FRONTMATTER.exec(text)?.[1] ?? '') : text;
}

type Binding = { spec: string; imported: string };

function bindingsOf(script: string): Map<string, Binding> {
  const bindings = new Map<string, Binding>();
  for (const [, clause, spec] of script.matchAll(IMPORT)) {
    const named = /\{([^}]*)\}/.exec(clause)?.[1] ?? '';
    const head = clause.replace(/\{[^}]*\}/, '').replace(/,/g, ' ').trim();
    if (head && !head.startsWith('*')) {
      bindings.set(head.split(/\s+/)[0], { spec, imported: DEFAULT_NAME });
    }
    for (const part of named.split(',').map((p) => p.trim()).filter(Boolean)) {
      const [imported, local = imported] = part.replace(/^type\s+/, '').split(/\s+as\s+/);
      bindings.set(local.trim(), { spec, imported: imported.trim() });
    }
  }

  return bindings;
}

function moduleFile(root: string, from: string, spec: string): string | null {
  const alias = ALIASES.find((a) => spec.startsWith(a.prefix));
  const base = alias ? `${alias.target}${spec.slice(alias.prefix.length)}` : spec.startsWith('.') ? join(dirname(from), spec) : null;
  if (base === null) {
    return null;
  }
  const found = CANDIDATES.map((suffix) => normalize(`${base}${suffix}`)).find((path) => !relative(root, join(root, path)).startsWith('..') && existsSync(join(root, path)) && statSync(join(root, path)).isFile());

  return found ? found.split(sep).join('/') : null;
}

export class Scopes {
  constructor(private readonly root: string) {}

  async lookup(file: string, text: string, depth: number, seen: string[]): Promise<Lookup> {
    const script = scriptOf(file, text);
    const bindings = bindingsOf(script);
    const imported = new Map<string, Resolved>();
    for (const [local, binding] of bindings) {
      imported.set(local, await this.importedValue(file, binding, depth, seen));
    }

    return this.scopeOf(script, imported);
  }

  private scopeOf(script: string, imported: Map<string, Resolved>): Lookup {
    const declared = (name: string): Resolved => {
      const pattern = new RegExp(`(?:^|[\\s;])(?:export\\s+)?(?:const|let|var)\\s+${escaped(name)}\\b\\s*(?::[^=\\n]+)?=(?!=)\\s*`).exec(script);

      return pattern ? valueAt(script, pattern.index + pattern[0].length, declared) : (imported.get(name) ?? UNRESOLVED);
    };

    return declared;
  }

  private async importedValue(from: string, { spec, imported }: Binding, depth: number, seen: string[]): Promise<Resolved> {
    const file = moduleFile(this.root, from, spec);
    if (file === null || depth >= MAX_DEPTH || seen.includes(file)) {
      return UNRESOLVED;
    }
    const text = await readFile(join(this.root, file), 'utf8').catch(() => null);
    if (text === null) {
      return UNRESOLVED;
    }
    if (JSON_FILE.test(file)) {
      return this.jsonValue(text, imported);
    }
    const lookup = await this.lookup(file, text, depth + 1, [...seen, file]);
    if (imported !== DEFAULT_NAME) {
      return lookup(imported);
    }
    const start = DEFAULT_EXPORT.exec(text);

    return start ? valueAt(text, start.index + start[0].length, lookup) : UNRESOLVED;
  }

  private jsonValue(text: string, imported: string): Resolved {
    try {
      const parsed = JSON.parse(text) as Json;
      if (imported === DEFAULT_NAME) {
        return parsed;
      }

      return parsed !== null && typeof parsed === 'object' && imported in parsed ? ((parsed as Record<string, Json>)[imported] ?? UNRESOLVED) : UNRESOLVED;
    } catch {
      return UNRESOLVED;
    }
  }
}
