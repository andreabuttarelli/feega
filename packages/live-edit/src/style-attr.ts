import { offsetOf, openTagEnd, type LiveAt } from './class-patch';
import type { ReadFile } from './files';
import type { TextWritten } from './literal-text';

export type Css = Record<string, string>;

const STYLE_LITERAL = /(\sstyle=)"([^"{}]*)"/;
const JSX_STYLE_LITERAL = /(\sstyle=)\{\{([^{}]*)\}\}/;
const JSX_ENTRY = /^\s*([A-Za-z]+|'--[\w-]+'):\s*'([^']*)'\s*$/;
const CUSTOM = /^--/;
const QUOTED = /^'(.*)'$/;
const STYLE_ANY = /\sstyle=/;
const JSX_FILE = /\.(t|j)sx$/;
const REMOVED = '';

const camel = (name: string) => (CUSTOM.test(name) ? `'${name}'` : name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()));

function declarations(text: string): Map<string, string> {
  const pairs = text
    .split(';')
    .map((d) => d.split(':').map((p) => p.trim()))
    .filter(([name, value]) => name && value);
  return new Map(pairs.map(([name, ...value]) => [name, value.join(':')]));
}

const cssText = (all: Map<string, string>) => [...all].map(([name, value]) => `${name}: ${value}`).join('; ');

const jsxStyle = (css: Css) => `{{ ${Object.entries(css).map(([name, value]) => `${camel(name)}: '${value}'`).join(', ')} }}`;

const kebab = (name: string) => (QUOTED.test(name) ? name.slice(1, -1) : name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));

function jsxDeclarations(text: string): Map<string, string> | null {
  const entries = text.split(',').filter((e) => e.trim()).map((e) => e.match(JSX_ENTRY));
  if (entries.some((e) => !e)) {
    return null;
  }
  return new Map(entries.map((e) => [kebab(e![1]), e![2]]));
}

function restyled(open: string, file: string, css: Css): string | null {
  const literal = open.match(STYLE_LITERAL);
  if (literal) {
    const all = declarations(literal[2]);
    Object.entries(css).forEach(([name, value]) => (value === REMOVED ? all.delete(name) : all.set(name, value)));
    return all.size ? open.replace(STYLE_LITERAL, `$1"${cssText(all)}"`) : open.replace(STYLE_LITERAL, '');
  }
  const jsx = open.match(JSX_STYLE_LITERAL);
  const jsxAll = jsx ? jsxDeclarations(jsx[2]) : null;
  if (jsx && jsxAll) {
    Object.entries(css).forEach(([name, value]) => (value === REMOVED ? jsxAll.delete(name) : jsxAll.set(name, value)));
    return jsxAll.size ? open.replace(JSX_STYLE_LITERAL, `$1${jsxStyle(Object.fromEntries(jsxAll))}`) : open.replace(JSX_STYLE_LITERAL, '');
  }
  if (STYLE_ANY.test(open)) {
    return null;
  }

  const added = Object.fromEntries(Object.entries(css).filter(([, value]) => value !== REMOVED));
  if (!Object.keys(added).length) {
    return open;
  }
  css = added;
  const closing = open.endsWith('/>') ? open.length - 2 : open.length - 1;
  const attr = JSX_FILE.test(file) ? `style=${jsxStyle(css)}` : `style="${cssText(new Map(Object.entries(css)))}"`;
  return `${open.slice(0, closing).trimEnd()} ${attr}${open.slice(closing)}`;
}

export async function styleAttr(read: ReadFile, at: LiveAt, css: Css): Promise<TextWritten> {
  const text = await read(at.file);
  const start = text === null ? -1 : offsetOf(text, at);
  const end = start < 0 || text![start] !== '<' ? -1 : openTagEnd(text!, start);
  if (end < 0) {
    return { ok: false, reason: `${at.file}:${at.line}: the element is not where the page says` };
  }

  const source = text!;
  const next = restyled(source.slice(start, end + 1), at.file, css);
  if (next === null) {
    return { ok: false, reason: `${at.file}:${at.line}: style is an expression, not written`, at };
  }
  const after = source.slice(0, start) + next + source.slice(end + 1);
  return { ok: true, change: { path: at.file, before: source, after } };
}
