<<<<<<<< HEAD:packages/live-edit/src/class-patch.ts
import { CLASS_RULE, LiveProp, Side, activeIndex, familyRule, utilityOf, variantOf, type ClassRule, type StyleProp } from './live-fields';
import type { FileChange, ReadFile } from './files';

export type LiveAt = { file: string; line: number; col: number };

export type LiveChange = { prop: LiveProp; family?: string; value: string; side?: Side; was?: string; viewport?: number };

export type LivePatched = { files: FileChange[]; skipped: string[] };

const CLASS_ATTR = /(\s(?:class|className)=)("([^"{}]*)"|\{)/;

export function offsetOf(text: string, at: LiveAt): number {
  const lines = text.split('\n');
  if (at.line < 1 || at.line > lines.length) {
    return -1;
  }
  return lines.slice(0, at.line - 1).reduce((sum, l) => sum + l.length + 1, 0) + at.col - 1;
}

export function openTagEnd(text: string, start: number): number {
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

function swapped(cls: string, rule: ClassRule, made: string, side: Side, viewport: number): string {
  const parts = cls.split(/(\s+)/);
  const at = activeIndex(parts, (utility) => rule.owns(utility, side), viewport);
  if (at < 0) {
    return [cls.trimEnd(), made].filter(Boolean).join(' ');
  }
  const variant = variantOf(parts[at]);
  const conflicting = parts.map((part, i) => (i !== at && part.trim() && variantOf(part) === variant && rule.owns(utilityOf(part), side) ? i : -1)).filter((i) => i >= 0);
  parts[at] = made && variant ? `${variant}:${made}` : made;
  conflicting.forEach((i) => (parts[i] = ''));
  return parts.join('').replace(/\s{2,}/g, ' ').trim();
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

export function stylePatch(read: ReadFile, at: LiveAt, change: LiveChange): Promise<LivePatched> {
  if (change.prop === LiveProp.Class) {
    const rule = familyRule(change.family ?? '');
    return rule ? classPatch(read, at, change, rule) : Promise.resolve({ files: [], skipped: [`${label(at)}: unknown class family ${change.family}`] });
  }
  return classPatch(read, at, change, CLASS_RULE[change.prop as StyleProp]);
========
import { LookKey } from '$lib/canvas/code-look';
import { LiveProp } from '@feega/live-edit/live-fields';
import { stylePatch, type LiveAt, type LiveChange, type LivePatched } from '@feega/live-edit/class-patch';
import { applyEdits, type ReadFile } from '$lib/server/code-import/write-back';

export type { LiveAt, LiveChange, LivePatched };

function textPatch(read: ReadFile, at: LiveAt, change: LiveChange): Promise<LivePatched> {
  const edit = { at: { file: at.file, line: at.line, column: at.col - 1 }, look: { [LookKey.Text]: change.value }, was: { [LookKey.Text]: change.was ?? '' } };
  return applyEdits([edit], read);
}

export function livePatch(read: ReadFile, at: LiveAt, change: LiveChange): Promise<LivePatched> {
  if (change.prop === LiveProp.Text) {
    return textPatch(read, at, change);
  }
  return stylePatch(read, at, change);
>>>>>>>> origin/feat/feega-inspect:src/lib/server/live-edit/live-patch.ts
}
