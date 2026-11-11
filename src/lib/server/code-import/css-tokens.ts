import { dirname, join, normalize } from 'node:path';
import type { ReadFile } from './write-back';

export type Sheet = { path: string; text: string };

export type DeclAt = { file: string; line: number; column: number };

export type Declared = { name: string; raw: string; mode: string; at: DeclAt };

export type VarRule = { selector: string; property: string; token: string };

export type ThemeBlock = { mode: string; close: DeclAt };

export type Parsed = { declared: Declared[]; rules: VarRule[]; skipped: string[]; blocks: ThemeBlock[] };

export const LIGHT = 'Light';
export const DARK = 'Dark';

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

const RELATIVE_IMPORT = /@import\s+(?:url\(\s*)?["'](\.{1,2}\/[^"']+\.css)["']/g;
const VAR_ONLY = /^var\(\s*(--[\w.-]+)\s*(?:,[^)]*)?\)$/;
const CUSTOM_PROPERTY = /^--[\w.-]+$/;
const BOUND_PROPERTIES = new Set(['color', 'background', 'background-color', 'border-color', 'gap', 'padding', 'border-radius']);

const title = (word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

const MODE_SELECTORS: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^(?::root|html|:host)$/, () => LIGHT],
  [/^(?::root|html)?\.light$/, () => LIGHT],
  [/^(?::root|html)?\.dark$/, () => DARK],
  [/^(?::root|html)?\[data-(?:theme|mode)=["']?([\w-]+)["']?\]$/, (m) => title(m[1])]
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
  return out;
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

const importsOf = (sheet: Sheet) => [...sheet.text.matchAll(RELATIVE_IMPORT)].map((m) => normalize(join(dirname(sheet.path), m[1])));

const insideRepo = (path: string) => !path.startsWith('..') && !path.startsWith('/');

export async function readSheets(read: ReadFile): Promise<Sheet[]> {
  const declaredSheet = await shadcnSheet(read);
  const queue = declaredSheet ? [declaredSheet] : [...CANDIDATE_SHEETS];
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
    queue.unshift(...importsOf(sheet).filter((p) => !seen.has(p)));
  }
  return sheets;
}
