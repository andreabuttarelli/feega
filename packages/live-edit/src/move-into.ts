import { offsetOf, openTagEnd, type LiveAt } from './class-patch';
import { elementRange } from './element-range';
import type { ReadFile } from './files';
import { hiddenOut, lineSpan, parentOf, repeated, spanOf, type Span } from './move-node';

export type Structured = { ok: true; changes: { path: string; before: string; after: string }[]; note?: string; selected?: LiveAt } | { ok: false; reason: string; at?: LiveAt };

const INDENT_UNIT = '  ';
const CLASS_ATTR = /\s(?:class|className)="([^"{}]+)"/;
const STYLE_BLOCK = /<style\b[\s\S]*?<\/style>/g;
const SIBLING_SHEETS = ['.module.css', '.css'];
const escaped = (token: string) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const indentOf = (line: string) => line.match(/^[ \t]*/)![0];

function reindented(piece: string, indent: string): string {
  const lines = piece.replace(/\n$/, '').split('\n');
  const first = lines.find((l) => l.trim()) ?? '';
  const strip = indentOf(first).length;
  return lines.map((l) => (l.trim() ? indent + l.slice(Math.min(strip, indentOf(l).length)) : l)).join('\n');
}

async function stylesOf(read: ReadFile, file: string, source: string): Promise<string> {
  const base = file.replace(/\.[^./]+$/, '');
  const sheets = await Promise.all(SIBLING_SHEETS.map((ext) => read(base + ext)));
  return [...(source.match(STYLE_BLOCK) ?? []), ...sheets.filter((s): s is string => s !== null)].join('\n');
}

function scopedTo(styles: string, classes: string): string | null {
  for (const token of classes.split(/\s+/).filter(Boolean)) {
    const rule = new RegExp(`\\.${escaped(token)}(?![\\w-])(?:\\s*[>+~]\\s*|\\s+)[.#a-zA-Z\\[*][^{,]*\\{`).exec(styles);
    if (rule) {
      return `.${token} has a rule scoped to it (${rule[0].replace(/\s*\{$/, '').trim()}): check the moved element's styles`;
    }
  }
  return null;
}

async function warning(read: ReadFile, file: string, source: string, text: string, parent: number): Promise<string | undefined> {
  if (parent < 0) {
    return undefined;
  }
  const open = text.slice(parent, openTagEnd(text, parent) + 1);
  const classes = open.match(CLASS_ATTR)?.[1];
  return classes ? (scopedTo(await stylesOf(read, file, source), classes) ?? undefined) : undefined;
}

export function placed(source: string, close: number, piece: string): { at: number; text: string } {
  const lineStart = source.lastIndexOf('\n', close - 1) + 1;
  const head = source.slice(lineStart, close);
  if (!head.trim()) {
    return { at: lineStart, text: reindented(piece, head + INDENT_UNIT) + '\n' };
  }
  const own = indentOf(source.slice(source.lastIndexOf('\n', close - 1) + 1));
  return { at: close, text: '\n' + reindented(piece, own + INDENT_UNIT) + '\n' + own };
}

export async function moveInto(read: ReadFile, from: LiveAt, to: LiveAt): Promise<Structured> {
  const source = await read(from.file);
  if (source === null || from.file !== to.file) {
    return { ok: false, reason: 'both elements must be in the same file' };
  }

  const text = hiddenOut(source);
  const moving = spanOf(text, offsetOf(text, from));
  const target = elementRange(text, offsetOf(text, to));
  if (!moving || !target) {
    return { ok: false, reason: `${from.file}: the elements are not where the page says` };
  }
  if (target.start >= moving.start && target.end <= moving.end) {
    return { ok: false, reason: 'an element cannot move into itself' };
  }
  if (target.closeStart === target.openEnd + 1 && target.end === target.closeStart) {
    return { ok: false, reason: 'the target has no room for children' };
  }

  const parent = parentOf(text, moving.start);
  const why = repeated(text, parent, moving.start) ?? repeated(text, parentOf(text, target.start), target.start);
  if (why) {
    return { ok: false, reason: why, at: from };
  }

  const cut: Span = lineSpan(source, moving);
  const without = source.slice(0, cut.start) + source.slice(cut.end);
  const shift = (offset: number) => (offset > cut.start ? offset - (cut.end - cut.start) : offset);
  const spot = placed(without, shift(target.closeStart), source.slice(cut.start, cut.end));
  const after = without.slice(0, spot.at) + spot.text + without.slice(spot.at);
  return { ok: true, changes: [{ path: from.file, before: source, after }], note: await warning(read, from.file, source, text, parent) };
}
