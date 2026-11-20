import { offsetOf, type LiveAt } from './class-patch';
import { declaredIn, dirOf, joined } from './data-source';
import { elementRange } from './element-range';
import type { FileChange, ReadFile } from './files';

export type SvgWritten = { ok: true; changes: FileChange[] } | { ok: false; reason: string; at?: LiveAt };

const HTML_EXPRESSION = /\{@html\s+([^}]+)\}/;
const SVG_ELEMENT = /<svg[\s>]/;
const JSX_FILE = /\.[jt]sx$/;
const LITERAL_START = /^\s*=\s*(?::\s*[\w<>\[\]| ]+\s*=\s*)?(['"`])/;
const ATTRIBUTE = /(\s)([a-z]+(?:[-:][a-z]+)+|class)=/g;

const camel = (name: string) => name.replace(/[-:]([a-z])/g, (_, c: string) => c.toUpperCase());
const KEEP_DASHED = /^(data|aria)-/;

function jsx(markup: string): string {
  return markup.replace(ATTRIBUTE, (all, space: string, name: string) => (KEEP_DASHED.test(name) ? all : `${space}${name === 'class' ? 'className' : camel(name)}=`));
}

const escapedLiteral = (markup: string) => `\`${markup.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\``;

function literalEnd(text: string, from: number, quote: string): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
      continue;
    }
    if (text[i] === quote) {
      return i;
    }
  }
  return -1;
}

async function constantChange(read: ReadFile, file: string, text: string, expression: string, markup: string): Promise<SvgWritten> {
  const name = expression.trim().match(/^[A-Za-z_$][\w$]*$/)?.[0];
  if (!name) {
    return { ok: false, reason: `The icon comes from \`${expression.trim()}\`, not a string constant.` };
  }
  const imported = text.match(new RegExp(`import\\s+${name}\\s+from\\s*['"](\\.{1,2}/[^'"]+?\\.svg)(?:\\?raw)?['"]`));
  if (imported) {
    const path = joined(dirOf(file), imported[1]);
    const before = await read(path);
    return before === null ? { ok: false, reason: `${path} is not readable` } : { ok: true, changes: [{ path, before, after: markup }] };
  }
  const reference = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"](\\.{1,2}/[^'"]+)['"]`).exec(text);
  const target = reference ? await moduleOf(read, joined(dirOf(file), reference[1])) : { path: file, body: text };
  const at = target ? declaredIn(target.body, target.path, name) : null;
  if (!target || !at) {
    return { ok: false, reason: `The icon comes from \`${name}\`, which is not a constant in this project.` };
  }
  const identifier = offsetOf(target.body, at) + name.length;
  const opening = target.body.slice(identifier).match(LITERAL_START);
  const open = opening ? identifier + opening[0].length : -1;
  const close = opening ? literalEnd(target.body, open, opening[1]) : -1;
  if (close < 0) {
    return { ok: false, reason: `\`${name}\` (${target.path}:${at.line}) is not a plain string.`, at };
  }
  const after = target.body.slice(0, open - 1) + escapedLiteral(markup) + target.body.slice(close + 1);
  return { ok: true, changes: [{ path: target.path, before: target.body, after }] };
}

const MODULE_EXTENSIONS = ['', '.ts', '.js', '.svelte.ts', '.svelte.js', '/index.ts', '/index.js'];

async function moduleOf(read: ReadFile, base: string): Promise<{ path: string; body: string } | null> {
  for (const extension of MODULE_EXTENSIONS) {
    const body = await read(base + extension);
    if (body !== null) {
      return { path: base + extension, body };
    }
  }
  return null;
}

export async function svgMarkup(read: ReadFile, at: LiveAt, markup: string, inner?: string): Promise<SvgWritten> {
  const source = await read(at.file);
  const start = source === null ? -1 : offsetOf(source, at);
  const range = source === null || source[start] !== '<' ? null : elementRange(source, start);
  if (source === null || !range) {
    return { ok: false, reason: `${at.file}:${at.line}: the element is not where the page says` };
  }

  const written = JSX_FILE.test(at.file) ? jsx(markup) : markup;
  if (range.tag === 'svg' && !inner) {
    return { ok: true, changes: [{ path: at.file, before: source, after: source.slice(0, range.start) + written + source.slice(range.end) }] };
  }

  const content = source.slice(range.openEnd + 1, range.closeStart);
  const html = content.match(HTML_EXPRESSION);
  if (html) {
    return constantChange(read, at.file, source, html[1], markup);
  }
  const child = content.match(SVG_ELEMENT);
  const childRange = child ? elementRange(source, range.openEnd + 1 + child.index!) : null;
  if (!childRange) {
    return { ok: false, reason: `${at.file}:${at.line}: no svg found in this element` };
  }
  return { ok: true, changes: [{ path: at.file, before: source, after: source.slice(0, childRange.start) + written + source.slice(childRange.end) }] };
}
