import { readFile } from 'node:fs/promises';
import { posix, relative, sep } from 'node:path';
import type { UsageSite } from '../messages';
import { scanProject } from './project-scan';

type Edge = { from: string; line: number; reexport: boolean; clause: string };

type Graph = Map<string, Edge[]>;

const STATEMENT = /(^|\n)[ \t]*(import|export)\s+(?:type\s+)?([^'";]*?)\s*from\s*['"]([^'"]+)['"]/g;
const LAZY = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
const NOT_A_USE = /\.(test|spec|stories)\.[jt]sx?$|(^|\/)__tests__\//;
const EXTENSIONS = ['.tsx', '.jsx', '.ts', '.js', '.svelte', '.vue', '.astro', '.mjs'];
const KNOWN_EXTENSION = /\.(tsx|jsx|ts|js|svelte|vue|astro|mjs)$/;
const ALIASES: [string, string][] = [
  ['$lib/', 'src/lib/'],
  ['@/', 'src/'],
  ['~/', 'src/']
];
const CACHE_TTL_MS = 5000;
const NO_LINE = 1;

const posixOf = (path: string) => path.split(sep).join('/');

const lineAt = (text: string, offset: number) => text.slice(0, offset).split('\n').length;

const localNames = (clause: string): string[] => {
  const named = [...clause.matchAll(/(?:\bas\s+)?(\w+)\s*(?:,|\}|$)/g)].map((m) => m[1]);
  return named.filter((name) => name !== 'default' && name !== 'type');
};

function edgesOf(from: string, text: string): { spec: string; edge: Edge }[] {
  const found = [...text.matchAll(STATEMENT)].map((m) => ({
    spec: m[4],
    edge: { from, line: lineAt(text, m.index! + m[1].length), reexport: m[2] === 'export', clause: m[3] }
  }));
  const lazy = [...text.matchAll(LAZY)].map((m) => ({ spec: m[1], edge: { from, line: lineAt(text, m.index!), reexport: false, clause: '' } }));
  return [...found, ...lazy];
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

async function aliasesOf(root: string): Promise<[string, string][]> {
  const found: [string, string][] = [];
  for (const name of ['tsconfig.json', 'jsconfig.json']) {
    const text = await readFile(posix.join(posixOf(root), name), 'utf8').catch(() => '');
    const paths = text.match(/"paths"\s*:\s*\{([^}]*)\}/)?.[1] ?? '';
    for (const m of paths.matchAll(/"([^"*]*)\*"\s*:\s*\[\s*"\.?\/?([^"*]*)\*"/g)) {
      found.push([m[1], m[2]]);
    }
  }
  return [...found, ...ALIASES];
}

function resolver(files: Set<string>, aliases: [string, string][]) {
  const exists = (base: string): string | null => {
    const candidates = KNOWN_EXTENSION.test(base) ? [base] : [...EXTENSIONS.map((e) => base + e), ...EXTENSIONS.map((e) => `${base}/index${e}`)];
    return candidates.find((c) => files.has(c)) ?? null;
  };
  return (spec: string, from: string): string | null => {
    if (spec.startsWith('.')) {
      return exists(posix.normalize(posix.join(posix.dirname(from), spec)));
    }
    const alias = aliases.find(([prefix]) => prefix && (spec.startsWith(prefix) || spec === prefix.replace(/\/$/, '')));
    return alias ? exists(posix.normalize(alias[1] + spec.slice(alias[0].length)).replace(/\/$/, '')) : null;
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

const reaches = (edge: Edge, names: Set<string> | null) => names === null || edge.clause === '' || importedNames(edge.clause).some((n) => n === STAR || names.has(n));

function usersIn({ graph, texts }: { graph: Graph; texts: Map<string, string> }, file: string): UsageSite[] {
  const users = new Map<string, number>();
  const queue: { file: string; names: Set<string> | null }[] = [{ file, names: null }];
  const seen = new Set([file]);
  for (const current of queue) {
    for (const edge of graph.get(current.file) ?? []) {
      if (edge.reexport && !seen.has(edge.from)) {
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

export function usageIndex(root: string, now: () => number = Date.now) {
  let cached: Promise<Awaited<ReturnType<typeof graphOf>>> | null = null;
  let builtAt = 0;
  let scans = 0;

  const built = () => {
    if (!cached || now() - builtAt > CACHE_TTL_MS) {
      scans++;
      builtAt = now();
      cached = graphOf(root);
    }
    return cached;
  };

  return {
    usersOf: async (file: string) => usersIn(await built(), file),
    invalidate: () => {
      cached = null;
    },
    scans: () => scans
  };
}

export type UsageIndex = ReturnType<typeof usageIndex>;
