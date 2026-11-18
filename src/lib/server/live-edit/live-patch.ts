import { LookKey } from '$lib/canvas/code-look';
import { CLASS_RULE, LiveProp, Side, type ClassRule } from '$lib/canvas/live-fields';
import { applyEdits, type FileChange, type ReadFile } from '$lib/server/code-import/write-back';

export type LiveAt = { file: string; line: number; col: number };

export type LiveChange = { prop: LiveProp; value: string; side?: Side; was?: string; viewport?: number };

export type LivePatched = { files: FileChange[]; skipped: string[] };

const CLASS_ATTR = /(\s(?:class|className)=)("([^"{}]*)"|\{)/;

function offsetOf(text: string, at: LiveAt): number {
  const lines = text.split('\n');
  if (at.line < 1 || at.line > lines.length) {
    return -1;
  }
  return lines.slice(0, at.line - 1).reduce((sum, l) => sum + l.length + 1, 0) + at.col - 1;
}

function openTagEnd(text: string, start: number): number {
  let quote = '';
  let depth = 0;
  for (let i = start + 1; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      quote = ch === quote ? '' : quote;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch;
      continue;
    }
    depth += ch === '{' ? 1 : ch === '}' ? -1 : 0;
    if (ch === '>' && depth === 0) {
      return i;
    }
  }
  return -1;
}

const BASE = '';
const MIN_WIDTH_PX: Record<string, number> = { [BASE]: 0, sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 };

const variantOf = (token: string) => token.slice(0, Math.max(0, token.lastIndexOf(':')));
const utilityOf = (token: string) => token.slice(token.lastIndexOf(':') + 1);
const appliesAt = (token: string, viewport: number) => (MIN_WIDTH_PX[variantOf(token)] ?? Infinity) <= viewport;

function swapped(cls: string, rule: ClassRule, made: string, side: Side, viewport: number): string {
  const parts = cls.split(/(\s+)/);
  const owned = parts.map((token, at) => ({ token, at })).filter(({ token }) => token.trim() && appliesAt(token, viewport) && rule.owns(utilityOf(token), side));
  if (!owned.length) {
    return cls.trimEnd() ? `${cls.trimEnd()} ${made}` : made;
  }
  const seen = owned.reduce((best, next) => (MIN_WIDTH_PX[variantOf(next.token)] > MIN_WIDTH_PX[variantOf(best.token)] ? next : best));
  const variant = variantOf(seen.token);
  parts[seen.at] = variant ? `${variant}:${made}` : made;
  return parts.join('');
}

const label = (at: LiveAt) => `${at.file}:${at.line}`;

async function classPatch(read: ReadFile, at: LiveAt, change: LiveChange, rule: ClassRule): Promise<LivePatched> {
  const text = await read(at.file);
  const start = text === null ? -1 : offsetOf(text, at);
  const end = start < 0 || text![start] !== '<' ? -1 : openTagEnd(text!, start);
  if (end < 0) {
    return { files: [], skipped: [`${label(at)}: the element is not where the page says`] };
  }

  const source = text!;
  const open = source.slice(start, end + 1);
  const found = open.match(CLASS_ATTR);
  if (found && !found[3] && found[2] === '{') {
    return { files: [], skipped: [`${label(at)}: class is not a literal, not written`] };
  }

  const side = change.side ?? Side.All;
  const made = rule.make(change.value, side);
  const closing = open.endsWith('/>') ? open.length - 2 : open.length - 1;
  const attr = /\.(t|j)sx$/.test(at.file) ? 'className' : 'class';
  const next = found ? open.replace(CLASS_ATTR, `$1"${swapped(found[3] ?? '', rule, made, side, change.viewport ?? 0)}"`) : `${open.slice(0, closing).trimEnd()} ${attr}="${made}"${open.slice(closing)}`;
  const after = source.slice(0, start) + next + source.slice(end + 1);
  return { files: after === source ? [] : [{ path: at.file, before: source, after }], skipped: [] };
}

function textPatch(read: ReadFile, at: LiveAt, change: LiveChange): Promise<LivePatched> {
  const edit = { at: { file: at.file, line: at.line, column: at.col - 1 }, look: { [LookKey.Text]: change.value }, was: { [LookKey.Text]: change.was ?? '' } };
  return applyEdits([edit], read);
}

export function livePatch(read: ReadFile, at: LiveAt, change: LiveChange): Promise<LivePatched> {
  if (change.prop === LiveProp.Text) {
    return textPatch(read, at, change);
  }
  return classPatch(read, at, change, CLASS_RULE[change.prop]);
}
