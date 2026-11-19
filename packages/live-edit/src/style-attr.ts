import { offsetOf, openTagEnd, type LiveAt } from './class-patch';
import type { ReadFile } from './files';
import type { TextWritten } from './literal-text';

export type Css = Record<string, string>;

const STYLE_LITERAL = /(\sstyle=)"([^"{}]*)"/;
const STYLE_ANY = /\sstyle=/;
const JSX_FILE = /\.(t|j)sx$/;

const camel = (name: string) => name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

function declarations(text: string): Map<string, string> {
  const pairs = text
    .split(';')
    .map((d) => d.split(':').map((p) => p.trim()))
    .filter(([name, value]) => name && value);
  return new Map(pairs.map(([name, ...value]) => [name, value.join(':')]));
}

const cssText = (all: Map<string, string>) => [...all].map(([name, value]) => `${name}: ${value}`).join('; ');

const jsxStyle = (css: Css) => `{{ ${Object.entries(css).map(([name, value]) => `${camel(name)}: '${value}'`).join(', ')} }}`;

function restyled(open: string, file: string, css: Css): string | null {
  const literal = open.match(STYLE_LITERAL);
  if (literal) {
    const all = declarations(literal[2]);
    Object.entries(css).forEach(([name, value]) => all.set(name, value));
    return open.replace(STYLE_LITERAL, `$1"${cssText(all)}"`);
  }
  if (STYLE_ANY.test(open)) {
    return null;
  }

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
