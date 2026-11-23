import { readFile } from 'node:fs/promises';
import { posix, relative, sep } from 'node:path';
import type { UsageSite } from '../messages';
import type { Watch } from './file-watch';
import { scanProject } from './project-scan';

type Edge = { from: string; line: number; reexport: boolean; clause: string };

type Graph = Map<string, Edge[]>;

const STATEMENT = /(^|\n)[ \t]*(import|export)\s+(?:type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g;
const LAZY = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
const NOT_A_USE = /\.(test|spec|stories)\.[jt]sx?$|(^|\/)__tests__\//;
const EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js', '.svelte', '.vue', '.astro', '.mjs'];
const KNOWN_EXTENSION = /\.(tsx|jsx|ts|js|svelte|vue|astro|mjs)$/;
type Alias = { prefix: string; target: string; exact: boolean };

const ALIASES: Alias[] = [
  { prefix: '$lib/', target: 'src/lib/', exact: false },
  { prefix: '@/', target: 'src/', exact: false },
  { prefix: '~/', target: 'src/', exact: false }
];
const LOCAL_EXPORT = /(^|\n)[ \t]*export\s*\{([^}]*)\}(?!\s*from\b)/g;
const DECLARED_EXPORT = /(^|\n)[ \t]*export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Z]\w*)/g;
const DEFAULT_EXPORT = /(^|\n)[ \t]*export\s+default\b/;
const JSX_FILE = /\.[jt]sx$/;
const SINGLE_COMPONENT_FILE = /\.(svelte|vue|astro)$/;
const PACKAGE_ENTRY = ['module', 'main', 'source'];
const DEFAULT_NAME = 'default';
const SAFETY_TTL_MS = 5 * 60_000;
const NO_LINE = 1;

const posixOf = (path: string) => path.split(sep).join('/');

const lineAt = (text: string, offset: number) => text.slice(0, offset).split('\n').length;

const localNames = (clause: string): string[] => {
  const named = [...clause.matchAll(/(?:\bas\s+)?(\w+)\s*(?:,|\}|$)/g)].map((m) => m[1]);
  return named.filter((name) => name !== 'default' && name !== 'type');
};

const asParts = (part: string) => part.trim().split(/\s+as\s+/);

function exposedLocals(text: string): Map<string, string> {
  const pairs = [...text.matchAll(LOCAL_EXPORT)].flatMap((m) => m[2].split(',').filter((part) => part.trim()).map(asParts));
  return new Map(pairs.map(([local, exposed = local]) => [local, exposed]));
}

function importedAs(clause: string, local: string): string | null {
  const head = clause.replace(/\{[^}]*\}/, '').trim().replace(/,$/, '').trim();
  if (head === local) {
    return DEFAULT_NAME;
  }
  const braces = clause.match(/\{([^}]*)\}/)?.[1] ?? '';
  const part = braces.split(',').map(asParts).find(([orig, alias = orig]) => alias === local);
  return part ? part[0] : null;
}

function reexported(from: string, text: string, found: { spec: string; edge: Edge }[]): { spec: string; edge: Edge }[] {
  const locals = exposedLocals(text);
  if (!locals.size) {
    return found;
  }
  return found.flatMap(({ spec, edge }) => {
    const names = [...locals].flatMap(([local, exposed]) => {
      const imported = edge.reexport ? null : importedAs(edge.clause, local);
      return imported === null ? [] : [`${imported} as ${exposed}`];
    });
    return names.length ? [{ spec, edge: { ...edge, from, reexport: true, clause: `{ ${names.join(', ')} }` } }] : [{ spec, edge }];
  });
}

function edgesOf(from: string, text: string): { spec: string; edge: Edge }[] {
  const found = [...text.matchAll(STATEMENT)].map((m) => ({
    spec: m[4],
    edge: { from, line: lineAt(text, m.index! + m[1].length), reexport: m[2] === 'export', clause: m[3] }
  }));
  const lazy = [...text.matchAll(LAZY)].map((m) => ({ spec: m[1], edge: { from, line: lineAt(text, m.index!), reexport: false, clause: '' } }));
  return reexported(from, text, [...found, ...lazy]);
}

function useLine(text: string, edge: Edge): number {
  const lines = text.split('\n');
  for (const name of localNames(edge.clause)) {
    const at = lines.findIndex((l, i) => i >= edge.line && new RegExp(`<${name}[\\s/>]`).test(l));
    if (at >= 0) {
      return at + 1;
    }
  }
  return edge.line;
}

const unslashed = (path: string) => path.replace(/^\.?\//, '');

async function packageAlias(root: string): Promise<Alias[]> {
  const text = await readFile(posix.join(posixOf(root), 'package.json'), 'utf8').catch(() => '');
  const name = text.match(/"name"\s*:\s*"([^"]+)"/)?.[1];
  const entry = PACKAGE_ENTRY.map((field) => text.match(new RegExp(`"${field}"\\s*:\\s*"([^"]+)"`))?.[1]).find(Boolean);
  return name ? [{ prefix: name, target: unslashed(entry ?? 'src/index'), exact: true }] : [];
}

async function aliasesOf(root: string): Promise<Alias[]> {
  const found: Alias[] = [];
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    const text = await readFile(posix.join(posixOf(root), name), 'utf8').catch(() => '');
    const paths = text.match(/"paths"\s*:\s*\{([^}]*)\}/)?.[1] ?? '';
    for (const m of paths.matchAll(/"([^"*]*)\*"\s*:\s*\[\s*"\.?\/?([^"*]*)\*"/g)) {
      found.push({ prefix: m[1], target: m[2], exact: false });
    }
    for (const m of paths.matchAll(/"([^"*]+)"\s*:\s*\[\s*"([^"*]+)"/g)) {
      found.push({ prefix: m[1], target: unslashed(m[2]), exact: true });
    }
  }
  return [...found, ...(await packageAlias(root)), ...ALIASES];
}

function resolver(files: Set<string>, aliases: Alias[]) {
  const exists = (base: string): string | null => {
    const candidates = KNOWN_EXTENSION.test(base) ? [base] : [...EXTENSIONS.map((e) => base + e), ...EXTENSIONS.map((e) => `${base}/index${e}`)];
    return candidates.find((c) => files.has(c)) ?? null;
  };
  return (spec: string, from: string): string | null => {
    if (spec.startsWith('.')) {
      return exists(posix.normalize(posix.join(posix.dirname(from), spec)));
    }
    const alias = aliases.find(({ prefix, exact }) => prefix && (exact ? spec === prefix : spec.startsWith(prefix) || spec === prefix.replace(/\/$/, '')));
    return alias ? exists(posix.normalize(alias.exact ? alias.target : alias.target + spec.slice(alias.prefix.length)).replace(/\/$/, '')) : null;
  };
}

async function graphOf(root: string): Promise<{ graph: Graph; texts: Map<string, string> }> {
  const scan = await scanProject(root, Infinity);
  const names = scan.sources.map((full) => posixOf(relative(root, full)));
  const resolve = resolver(new Set(names), await aliasesOf(root));
  const texts = new Map<string, string>();
  const graph: Graph = new Map();
  await Promise.all(
    names.map(async (name) => {
      const text = await readFile(posix.join(posixOf(root), name), 'utf8').catch(() => '');
      texts.set(name, text);
    })
  );
  for (const [from, text] of texts) {
    for (const { spec, edge } of edgesOf(from, text)) {
      const target = resolve(spec, from);
      if (target) {
        graph.set(target, [...(graph.get(target) ?? []), edge]);
      }
    }
  }
  return { graph, texts };
}

const STAR = '*';

function importedNames(clause: string): string[] {
  const braces = clause.match(/\{([^}]*)\}/)?.[1] ?? '';
  const named = braces.split(',').map((part) => part.trim().split(/\s+as\s+/)[0]).filter(Boolean);
  const head = clause.replace(/\{[^}]*\}/, '').trim().replace(/,$/, '').trim();
  const outer = head.startsWith(STAR) ? [STAR] : head ? ['default'] : [];
  return [...outer, ...named];
}

function exportedNames(clause: string): string[] | null {
  if (clause.trim() === STAR) {
    return null;
  }
  const braces = clause.match(/\{([^}]*)\}/)?.[1];
  if (braces === undefined) {
    return [clause.replace(/^\*\s+as\s+/, '').trim()];
  }
  return braces.split(',').map((part) => part.trim().split(/\s+as\s+/).pop()!).filter(Boolean);
}

function componentNames(file: string, text: string): Set<string> | null {
  if (SINGLE_COMPONENT_FILE.test(file)) {
    return new Set([DEFAULT_NAME]);
  }
  if (!JSX_FILE.test(file)) {
    return null;
  }
  const declared = [...text.matchAll(DECLARED_EXPORT)].map((m) => m[2]);
  const listed = [...exposedLocals(text).values()].filter((name) => /^[A-Z]/.test(name));
  const names = new Set([...declared, ...listed, ...(DEFAULT_EXPORT.test(text) ? [DEFAULT_NAME] : [])]);
  return names.size ? names : null;
}

const reaches = (edge: Edge, names: Set<string> | null) => names === null || edge.clause === '' || importedNames(edge.clause).some((n) => n === STAR || names.has(n));

function usersIn({ graph, texts }: { graph: Graph; texts: Map<string, string> }, file: string): UsageSite[] {
  const users = new Map<string, number>();
  const queue: { file: string; names: Set<string> | null }[] = [{ file, names: componentNames(file, texts.get(file) ?? '') }];
  const seen = new Set([file]);
  for (const current of queue) {
    for (const edge of graph.get(current.file) ?? []) {
      if (edge.reexport && reaches(edge, current.names) && !seen.has(edge.from)) {
        const exposed = exportedNames(edge.clause);
        seen.add(edge.from);
        queue.push({ file: edge.from, names: exposed === null ? current.names : new Set(exposed) });
        continue;
      }
      if (!edge.reexport && reaches(edge, current.names) && !seen.has(edge.from) && !NOT_A_USE.test(edge.from) && !users.has(edge.from)) {
        users.set(edge.from, useLine(texts.get(edge.from) ?? '', edge) || NO_LINE);
      }
    }
  }
  return [...users].map(([from, line]) => ({ file: from, line }));
}

type IndexOptions = { now?: () => number; watch?: Watch };

export function usageIndex(root: string, { now = Date.now, watch }: IndexOptions = {}) {
  let cached: Promise<Awaited<ReturnType<typeof graphOf>>> | null = null;
  let builtAt = 0;
  let scans = 0;
  let watching: { dispose: () => void } | null = null;

  const invalidate = () => {
    cached = null;
  };

  const built = () => {
    watching ??= watch?.(root, invalidate) ?? null;
    if (!cached || now() - builtAt > SAFETY_TTL_MS) {
      scans++;
      builtAt = now();
      cached = graphOf(root);
    }
    return cached;
  };

  return {
    usersOf: async (file: string) => usersIn(await built(), file),
    invalidate,
    dispose: () => {
      watching?.dispose();
      watching = null;
    },
    scans: () => scans
  };
}

export type UsageIndex = ReturnType<typeof usageIndex>;
