import { AddStyle, classAttribute } from './add-node';
import { offsetOf, type LiveAt } from './class-patch';
import { elementRange, type ElementRange } from './element-range';
import type { ReadFile } from './files';
import { indentOf, type Structured } from './move-into';
import { hiddenOut, lineSpan, parentOf, repeated, type Span } from './move-node';

const INDENT_UNIT = '  ';
const WRAPPER_TAILWIND = 'flex flex-col';

const COLUMN_CSS = { display: 'flex', 'flex-direction': 'column' };

export enum WrapTag {
  Div = 'div',
  Section = 'section',
  Article = 'article',
  Nav = 'nav',
  Header = 'header',
  Footer = 'footer',
  Link = 'a',
  Button = 'button'
}

type Wrapper = { attrs: string; tailwind: string; css: Record<string, string> };

const BOX: Wrapper = { attrs: '', tailwind: WRAPPER_TAILWIND, css: COLUMN_CSS };

const WRAPPERS: Record<WrapTag, Wrapper> = {
  [WrapTag.Div]: BOX,
  [WrapTag.Section]: BOX,
  [WrapTag.Article]: BOX,
  [WrapTag.Nav]: BOX,
  [WrapTag.Header]: BOX,
  [WrapTag.Footer]: BOX,
  [WrapTag.Link]: { attrs: ' href="#"', tailwind: '', css: {} },
  [WrapTag.Button]: { attrs: '', tailwind: '', css: {} }
};

export const wrapperCss = (tag = WrapTag.Div): Record<string, string> => WRAPPERS[tag].css;

function wrapperOpen(file: string, style: AddStyle, tag: WrapTag): string {
  const wrapper = WRAPPERS[tag];
  const classes = style === AddStyle.Tailwind && wrapper.tailwind ? classAttribute(file, wrapper.tailwind) : '';
  return `<${tag}${wrapper.attrs}${classes}>`;
}

type Located = { source: string; text: string; start: number };

const lineCol = (text: string, offset: number) => {
  const lines = text.slice(0, offset).split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
};

async function located(read: ReadFile, at: LiveAt): Promise<Located | string> {
  const source = await read(at.file);
  if (source === null) {
    return `${at.file}: cannot read the file`;
  }

  const text = hiddenOut(source);
  const start = offsetOf(text, at);
  return repeated(text, parentOf(text, start), start) ?? { source, text, start };
}

const lined = (piece: string, prefix: string) =>
  piece
    .replace(/\n$/, '')
    .split('\n')
    .map((l) => (l.trim() ? prefix + l : l))
    .join('\n');

const dedented = (block: string) =>
  block
    .split('\n')
    .map((l) => (l.startsWith(INDENT_UNIT) ? l.slice(INDENT_UNIT.length) : l))
    .join('\n');

function wrapped(source: string, file: string, range: Span, open: string, close: string): Structured {
  const whole = lineSpan(source, range);
  const inline = whole.start === range.start && whole.end === range.end;
  const indent = indentOf(source.slice(source.lastIndexOf('\n', range.start - 1) + 1));
  const piece = source.slice(whole.start, whole.end);
  const block = inline ? `${open}${piece}${close}` : `${indent}${open}\n${lined(piece, INDENT_UNIT)}\n${indent}${close}${piece.endsWith('\n') ? '\n' : ''}`;
  const after = source.slice(0, whole.start) + block + source.slice(whole.end);
  const wrapper = inline ? whole.start : whole.start + indent.length;
  return { ok: true, changes: [{ path: file, before: source, after }], selected: { file, ...lineCol(after, wrapper) } };
}

export async function wrapNode(read: ReadFile, at: LiveAt, style = AddStyle.Plain, tag = WrapTag.Div): Promise<Structured> {
  const found = await located(read, at);
  if (typeof found === 'string') {
    return { ok: false, reason: found, at };
  }

  const { source, text, start } = found;
  const range = elementRange(text, start);
  if (!range) {
    return { ok: false, reason: `${at.file}: the element is not where the page says` };
  }

  return wrapped(source, at.file, range, wrapperOpen(at.file, style, tag), `</${tag}>`);
}

const refused = (reason: string, at?: LiveAt): Structured => ({ ok: false, reason, at });

export async function wrapNodes(read: ReadFile, ats: LiveAt[], style = AddStyle.Plain, tag = WrapTag.Div): Promise<Structured> {
  if (ats.length === 1) {
    return wrapNode(read, ats[0], style, tag);
  }

  const file = ats[0].file;
  if (ats.some((at) => at.file !== file)) {
    return refused('wrapping needs elements of the same file');
  }

  const source = await read(file);
  if (source === null) {
    return refused(`${file}: cannot read the file`);
  }

  const text = hiddenOut(source);
  const ranges = ats.map((at) => elementRange(text, offsetOf(text, at)));
  if (ranges.some((range) => range === null)) {
    return refused(`${file}: an element is not where the page says`);
  }

  const items = ranges.filter((range): range is ElementRange => range !== null).sort((a, b) => a.start - b.start).filter((range, i, all) => i === 0 || range.start !== all[i - 1].start);
  const parent = parentOf(text, items[0].start);
  if (items.some((item) => parentOf(text, item.start) !== parent)) {
    return refused('wrapping needs elements of the same parent');
  }

  const loop = repeated(text, parent, items[0].start);
  if (loop) {
    return refused(loop);
  }

  if (items.some((item, i) => i > 0 && text.slice(items[i - 1].end, item.start).trim() !== '')) {
    return refused('wrapping needs elements next to each other');
  }

  return wrapped(source, file, { start: items[0].start, end: items.at(-1)!.end }, wrapperOpen(file, style, tag), `</${tag}>`);
}

export async function unwrapNode(read: ReadFile, at: LiveAt): Promise<Structured> {
  const found = await located(read, at);
  if (typeof found === 'string') {
    return { ok: false, reason: found, at };
  }

  const { source, text, start } = found;
  const range = elementRange(text, start);
  if (!range || range.end === range.openEnd + 1) {
    return { ok: false, reason: 'the element has no children to unwrap', at };
  }

  const whole = lineSpan(source, range);
  const inner = source.slice(range.openEnd + 1, range.closeStart);
  const stacked = whole.start !== range.start || whole.end !== range.end;
  const block = stacked ? dedented(inner.replace(/^[ \t]*\n/, '').replace(/\n[ \t]*$/, '\n')) : inner.trim();
  const after = source.slice(0, whole.start) + block + source.slice(whole.end);
  return { ok: true, changes: [{ path: at.file, before: source, after }] };
}
