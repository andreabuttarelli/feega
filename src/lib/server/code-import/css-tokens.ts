import { dirname, join, normalize } from 'node:path';
import type { PageSheet } from '$lib/server/url-import/page-tree';
import type { ReadFile } from './write-back';

export type Sheet = { path: string; text: string };

export type LoadedSheet = PageSheet;

export const PAGE_SHEET = 'page:';

export const READ_ONLY = 'read from the running page, no source file: read-only';

export const fromPage = (file: string) => file.startsWith(PAGE_SHEET);

export type DeclAt = { file: string; line: number; column: number };

export type Declared = { name: string; raw: string; mode: string; at: DeclAt };

export type VarRule = { selector: string; property: string; token: string };

export type ThemeBlock = { mode: string; close: DeclAt };

export type Parsed = { declared: Declared[]; rules: VarRule[]; skipped: string[]; blocks: ThemeBlock[] };

export const LIGHT = 'Light';
export const DARK = 'Dark';
export const ACCENT = 'Accent';

const ACCENT_MARK = `${ACCENT}:`;

export const accentOf = (mode: string) => (mode.startsWith(ACCENT_MARK) ? mode.slice(ACCENT_MARK.length) : null);

const SHADCN_CONFIG = 'components.json';
const MAX_SHEETS = 24;
const MAX_SHEET_BYTES = 512 * 1024;

const CANDIDATE_SHEETS = [
  'src/app.css',
  'src/app/globals.css',
  'app/globals.css',
  'src/styles/globals.css',
  'styles/globals.css',
  'src/index.css',
  'src/globals.css',
  'src/global.css',
  'src/styles.css',
  'src/styles/global.css',
  'src/styles/app.css',
  'src/assets/main.css',
  'app/app.css',
  'assets/css/main.css'
];

const IMPORT = /@import\s+(?:url\(\s*)?["']([^"']+)["']/g;
const RELATIVE = /^\.{1,2}\//;
const PACKAGE_PATH = /^((?:@[\w.-]+\/)?[\w.-]+)\/(.+)$/;
const ROOT_MANIFEST = 'package.json';
const PNPM_WORKSPACE = 'pnpm-workspace.yaml';
const PNPM_ENTRY = /^\s*-\s*["']?([^"'#\s]+)["']?/;
const CSS_FILE = /\.css$/;
const MAX_SOURCE_DEPTH = 12;
const VAR_ONLY = /^var\(\s*(--[\w.-]+)\s*(?:,[^)]*)?\)$/;
const CUSTOM_PROPERTY = /^--[\w.-]+$/;
const BOUND_PROPERTIES = new Set(['color', 'background', 'background-color', 'border-color', 'gap', 'padding', 'border-radius']);

const title = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

const MODE_SELECTORS: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^(?::root|html|:host)$/, () => LIGHT],
  [/^(?::root|html)?\.light$/, () => LIGHT],
  [/^(?::root|html)?\.dark$/, () => DARK],
  [/^(?::root|html)?\[data-(?:theme|mode)=["']?([\w-]+)["']?\]$/, (m) => title(m[1])],
  [/^(?::root|html)?\[data-accent=["']?([\w-]+)["']?\]$/, (m) => `${ACCENT_MARK}${title(m[1])}`]
];

const SCHEME_MEDIA = /^@media\s*\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)$/i;
const THEME_AT = /^@theme\b/;
const TRANSPARENT_AT = /^@(layer|supports)\b/;

enum Frame {
  Theme = 'theme',
  Scheme = 'scheme',
  Transparent = 'transparent',
  Other = 'other',
  Rule = 'rule'
}

type Block = { frame: Frame; label: string; mode: string | null };

function modeOfSelector(selector: string): string | null {
  const modes = selector.split(',').map((part) => {
    const s = part.trim();
    const hit = MODE_SELECTORS.map(([re, of]) => {
      const m = re.exec(s);
      return m ? of(m) : null;
    }).find(Boolean);
    return hit ?? null;
  });
  return modes.every((m) => m && m === modes[0]) ? modes[0] : null;
}

function blockOf(prelude: string): Block {
  const scheme = SCHEME_MEDIA.exec(prelude);
  if (scheme) {
    return { frame: Frame.Scheme, label: prelude, mode: title(scheme[1]) };
  }
  if (THEME_AT.test(prelude)) {
    return { frame: Frame.Theme, label: prelude, mode: LIGHT };
  }
  if (TRANSPARENT_AT.test(prelude)) {
    return { frame: Frame.Transparent, label: prelude, mode: null };
  }
  if (prelude.startsWith('@')) {
    return { frame: Frame.Other, label: prelude, mode: null };
  }
  return { frame: Frame.Rule, label: prelude, mode: modeOfSelector(prelude) };
}

function blanked(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      starts.push(i + 1);
    }
  }
  return starts;
}

function atOf(starts: number[], file: string, offset: number): DeclAt {
  let line = 0;
  while (line + 1 < starts.length && starts[line + 1] <= offset) {
    line++;
  }
  return { file, line: line + 1, column: offset - starts[line] };
}

type Context = { mode: string | null; outside: Block | null; rule: Block | null };

function contextOf(stack: Block[]): Context {
  const rule = stack.findLast((b) => b.frame === Frame.Rule) ?? null;
  const theme = stack.some((b) => b.frame === Frame.Theme);
  const scheme = stack.findLast((b) => b.frame === Frame.Scheme);
  const outside = stack.find((b) => b.frame === Frame.Other) ?? null;
  const own = theme ? LIGHT : (rule?.mode ?? null);
  const mode = own && scheme && own === LIGHT ? scheme.mode : own;
  return { mode, outside, rule };
}

type Collected = Parsed;

function declare(out: Collected, stack: Block[], text: string, start: number, end: number, place: (offset: number) => DeclAt): void {
  const chunk = text.slice(start, end);
  const colon = chunk.indexOf(':');
  if (colon < 0) {
    return;
  }
  const lead = chunk.length - chunk.trimStart().length;
  const name = chunk.slice(0, colon).trim();
  const raw = chunk.slice(colon + 1).trim();
  const context = contextOf(stack);

  if (!CUSTOM_PROPERTY.test(name)) {
    const token = VAR_ONLY.exec(raw)?.[1];
    if (token && context.rule && !context.rule.mode && !context.outside && BOUND_PROPERTIES.has(name)) {
      out.rules.push({ selector: context.rule.label, property: name, token });
    }
    return;
  }

  if (context.outside || !context.mode) {
    const where = [context.outside?.label, context.rule?.label].filter(Boolean).join(' ');
    out.skipped.push(`${name} under ${where} is not a theme`);
    return;
  }
  out.declared.push({ name, raw, mode: context.mode, at: place(start + lead) });
}

function closed(out: Collected, stack: Block[], firstDeclared: number, at: DeclAt): void {
  const context = contextOf(stack);
  const own = out.declared.slice(firstDeclared).some((d) => d.at.file === at.file);
  if (own && context.mode && !context.outside) {
    out.blocks.push({ mode: context.mode, close: at });
  }
}

function parseOne(sheet: Sheet, out: Collected): void {
  const text = blanked(sheet.text);
  const starts = lineStarts(text);
  const place = (offset: number) => atOf(starts, sheet.path, offset);
  const stack: Block[] = [];
  const declaredIn: number[] = [];
  let from = 0;
  let quote = '';
  let parens = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      quote = ch === quote ? '' : quote;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    parens += ch === '(' ? 1 : ch === ')' ? -1 : 0;
    if (parens > 0) {
      continue;
    }
    if (ch === '{') {
      stack.push(blockOf(text.slice(from, i).trim()));
      declaredIn.push(out.declared.length);
      from = i + 1;
    } else if (ch === ';' || ch === '}') {
      if (stack.length) {
        declare(out, stack, text, from, i, place);
      }
      if (ch === '}') {
        closed(out, stack, declaredIn.pop() ?? out.declared.length, place(i));
        stack.pop();
      }
      from = i + 1;
    }
  }
}

export function parseSheets(sheets: Sheet[]): Parsed {
  const out: Collected = { declared: [], rules: [], skipped: [], blocks: [] };
  sheets.forEach((sheet) => parseOne(sheet, out));
  const inFiles = new Set(out.declared.filter((d) => !fromPage(d.at.file)).map((d) => d.name));
  return { ...out, declared: out.declared.filter((d) => !fromPage(d.at.file) || !inFiles.has(d.name)) };
}

async function shadcnSheet(read: ReadFile): Promise<string | null> {
  const raw = await read(SHADCN_CONFIG).catch(() => null);
  if (!raw) {
    return null;
  }
  try {
    const css = (JSON.parse(raw) as { tailwind?: { css?: unknown } }).tailwind?.css;
    return typeof css === 'string' && css ? normalize(css).replace(/^\.\//, '') : null;
  } catch {
    return null;
  }
}

type Manifest = { name?: unknown; exports?: unknown; workspaces?: unknown };

async function manifestAt(read: ReadFile, path: string): Promise<Manifest | null> {
  const raw = await read(path).catch(() => null);
  try {
    return raw ? (JSON.parse(raw) as Manifest) : null;
  } catch {
    return null;
  }
}

async function workspaceDirs(read: ReadFile): Promise<string[]> {
  const root = await manifestAt(read, ROOT_MANIFEST);
  const declared = Array.isArray(root?.workspaces) ? root.workspaces : ((root?.workspaces as { packages?: unknown } | undefined)?.packages ?? []);
  const pnpm = ((await read(PNPM_WORKSPACE).catch(() => null)) ?? '').split('\n').flatMap((line) => PNPM_ENTRY.exec(line)?.[1] ?? []);
  const globs = [...(Array.isArray(declared) ? declared : []), ...pnpm].filter((g): g is string => typeof g === 'string');
  return [...new Set(globs.map((g) => g.replace(/\/\*{1,2}$/, '').replace(/^\.\//, '')))];
}

function exported(manifest: Manifest, rest: string): string {
  const target = (manifest.exports as Record<string, unknown> | undefined)?.[`./${rest}`];
  const picked = typeof target === 'string' ? target : ['style', 'import', 'default'].map((k) => (target as Record<string, unknown> | undefined)?.[k]).find((v) => typeof v === 'string');
  return typeof picked === 'string' ? picked : rest;
}

type PackageResolver = (spec: string) => Promise<string | null>;

function packageResolver(read: ReadFile): PackageResolver {
  let dirs: Promise<string[]> | null = null;
  return async (spec) => {
    const m = PACKAGE_PATH.exec(spec);
    if (!m) {
      return null;
    }
    const [, name, rest] = m;
    const leaf = name.split('/').pop()!;
    dirs ??= workspaceDirs(read);
    for (const dir of await dirs) {
      const home = dir.endsWith(`/${leaf}`) || dir === leaf ? dir : `${dir}/${leaf}`;
      const manifest = await manifestAt(read, `${home}/${ROOT_MANIFEST}`);
      if (manifest?.name === name) {
        return normalize(join(home, exported(manifest, rest)));
      }
    }
    return null;
  };
}

async function importsOf(sheet: Sheet, resolve: PackageResolver): Promise<string[]> {
  const specs = [...sheet.text.matchAll(IMPORT)].map((m) => m[1]);
  const paths = await Promise.all(specs.map((spec) => (RELATIVE.test(spec) ? normalize(join(dirname(sheet.path), spec)) : resolve(spec))));
  return paths.filter((p): p is string => Boolean(p) && CSS_FILE.test(p!));
}

const insideRepo = (path: string) => !path.startsWith('..') && !path.startsWith('/');

async function sourceOf(read: ReadFile, at: string | undefined): Promise<string | null> {
  const bare = (at ?? '').split(/[?#]/)[0].replace(/^\/@fs\//, '/');
  if (!CSS_FILE.test(bare)) {
    return null;
  }
  const parts = bare.split('/').filter(Boolean);
  for (let i = Math.max(0, parts.length - MAX_SOURCE_DEPTH); i < parts.length; i++) {
    const path = parts.slice(i).join('/');
    if ((await read(path).catch(() => null)) !== null) {
      return path;
    }
  }
  return null;
}

export async function readSheets(read: ReadFile, loaded: LoadedSheet[] = []): Promise<Sheet[]> {
  const declaredSheet = await shadcnSheet(read);
  const found = await Promise.all(loaded.map((l) => sourceOf(read, l.at)));
  const queue = [...(declaredSheet ? [declaredSheet] : CANDIDATE_SHEETS), ...found.filter((p): p is string => Boolean(p))];
  const resolve = packageResolver(read);
  const seen = new Set<string>();
  const sheets: Sheet[] = [];

  while (queue.length && sheets.length < MAX_SHEETS) {
    const path = queue.shift()!;
    if (seen.has(path) || !insideRepo(path)) {
      continue;
    }
    seen.add(path);
    const text = await read(path).catch(() => null);
    if (text === null || text.length > MAX_SHEET_BYTES) {
      continue;
    }
    const sheet = { path, text };
    sheets.push(sheet);
    queue.unshift(...(await importsOf(sheet, resolve)).filter((p) => !seen.has(p)));
  }

  const onPage = loaded.flatMap((l, i) => (found[i] || !l.text || l.text.length > MAX_SHEET_BYTES ? [] : [{ path: `${PAGE_SHEET}${l.at ?? `inline ${i + 1}`}`, text: l.text }]));
  return [...sheets, ...onPage].slice(0, MAX_SHEETS);
}
