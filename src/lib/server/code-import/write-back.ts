import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { changedLook, LOOK, LookKey, minSideOf, type Look, type LookValue } from '$lib/canvas/code-look';
import { BASE_CONDITIONS, parseKey, Scheme } from './render-conditions';

export type SourceAt = { file: string; line: number; column: number };

export type Spot = { tag: string; cls: string };

export type SourceEdit = { at: SourceAt; look: Look; was: Look; spot?: Spot; cond?: string };

export type FileChange = { path: string; before: string; after: string };

export type ReadFile = (path: string) => Promise<string | null>;

export type Applied = { files: FileChange[]; skipped: string[] };

const AT = /^(.+):(\d+):(\d+)$/;
const DIFF_CONTEXT = 3;
const INLANG_SETTINGS = 'project.inlang/settings.json';
const LANGUAGE_TAG = '{languageTag}';
const JSX_FILE = /\.(t|j)sx$/;

export const atOf = (raw: string): SourceAt | null => {
  const m = raw.match(AT);
  return m ? { file: m[1].replace(/^\.?\//, ''), line: Number(m[2]), column: Number(m[3]) } : null;
};

const label = (at: SourceAt) => `${at.file}:${at.line}`;

const allClips = (doc: MotionDoc): MotionClip[] => [...doc.tracks, ...Object.values(doc.comps).flatMap((c) => c.tracks)].flatMap((t) => t.clips as MotionClip[]);

export function editsOf(doc: MotionDoc): SourceEdit[] {
  const side = minSideOf(doc);
  const byAt = new Map<string, SourceEdit>();
  for (const clip of allClips(doc)) {
    const at = clip.source ? atOf(clip.source.at) : null;
    const look = at ? changedLook(clip, side) : {};
    const key = `${clip.source?.at}|${clip.source?.cond ?? ''}`;
    if (!at || !Object.keys(look).length || byAt.has(key)) {
      continue;
    }
    const { tag, cls, cond } = clip.source!;
    byAt.set(key, { at, look, was: clip.source!.was, ...(tag ? { spot: { tag, cls: cls ?? '' } } : {}), ...(cond ? { cond } : {}) });
  }
  return [...byAt.values()];
}

function offsetOf(text: string, at: SourceAt): number {
  let offset = 0;
  for (let line = 1; line < at.line; line++) {
    const next = text.indexOf('\n', offset);
    if (next < 0) {
      return -1;
    }
    offset = next + 1;
  }
  return offset + at.column;
}

function tagEnd(text: string, start: number): number {
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

type Tag = { start: number; end: number };

const CLASS_ATTR = /\sclass="([^"{}]*)"/;
const tokens = (cls: string) => cls.split(/\s+/).filter(Boolean).sort().join(' ');
const lineOf = (text: string, offset: number) => text.slice(0, offset).split('\n').length;

function tagFrom(text: string, start: number): Tag | null {
  const end = tagEnd(text, start);
  return end < 0 ? null : { start, end };
}

function opensAt(text: string, start: number, tag: string | null): boolean {
  const name = text.slice(start + 1).match(/^[A-Za-z][\w-]*/)?.[0];
  return text[start] === '<' && Boolean(name) && (!tag || name === tag);
}

function sameSpot(text: string, start: number, spot: Spot): boolean {
  const found = tagFrom(text, start);
  const cls = found ? (text.slice(found.start, found.end + 1).match(CLASS_ATTR)?.[1] ?? '') : null;
  return cls !== null && tokens(cls) === tokens(spot.cls);
}

function tagAt(text: string, at: SourceAt, spot?: Spot): Tag | null {
  const start = offsetOf(text, at);
  if (start >= 0 && opensAt(text, start, spot?.tag ?? null)) {
    return tagFrom(text, start);
  }
  if (!spot) {
    return null;
  }
  const candidates = [...text.matchAll(new RegExp(`<${spot.tag}(?=[\\s>/])`, 'g'))].map((m) => m.index!).filter((i) => sameSpot(text, i, spot));
  const nearest = candidates.sort((a, b) => Math.abs(lineOf(text, a) - at.line) - Math.abs(lineOf(text, b) - at.line))[0];
  return nearest === undefined ? null : tagFrom(text, nearest);
}

const STYLE_ATTR = /\sstyle="([^"]*)"/;

function styled(text: string, tag: Tag, css: [string, string][], jsx: boolean): string | null {
  const open = text.slice(tag.start, tag.end + 1);
  const closing = open.endsWith('/>') ? open.length - 2 : open.length - 1;
  if (jsx) {
    if (/\sstyle=/.test(open)) {
      return null;
    }
    const object = css.map(([k, v]) => `${k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}: ${JSON.stringify(v)}`).join(', ');
    return text.slice(0, tag.start) + open.slice(0, closing).trimEnd() + ` style={{ ${object} }}` + open.slice(closing) + text.slice(tag.end + 1);
  }
  const existing = open.match(STYLE_ATTR);
  const declared = new Map((existing?.[1] ?? '').split(';').map((d) => d.split(':').map((s) => s.trim())).filter((d) => d[0]).map((d) => [d[0], d.slice(1).join(':')] as [string, string]));
  css.forEach(([k, v]) => declared.set(k, v));
  const attr = ` style="${[...declared].map(([k, v]) => `${k}: ${v}`).join('; ')}"`;
  const next = existing ? open.replace(STYLE_ATTR, attr) : open.slice(0, closing).trimEnd() + attr + open.slice(closing);
  return text.slice(0, tag.start) + next + text.slice(tag.end + 1);
}

function literalText(text: string, tag: Tag, from: string, to: string): string | null {
  const close = text.indexOf('<', tag.end + 1);
  const content = text.slice(tag.end + 1, close < 0 ? text.length : close);
  const at = content.indexOf(from.trim());
  if (!from.trim() || at < 0 || content.trim() !== from.trim()) {
    return null;
  }
  const offset = tag.end + 1 + at;
  return text.slice(0, offset) + to + text.slice(offset + from.trim().length);
}

async function catalogues(read: ReadFile): Promise<string[]> {
  const raw = await read(INLANG_SETTINGS);
  const settings = raw ? (JSON.parse(raw) as { languageTags?: string[]; 'plugin.inlang.messageFormat'?: { pathPattern?: string } }) : null;
  const pattern = settings?.['plugin.inlang.messageFormat']?.pathPattern;
  return pattern ? (settings?.languageTags ?? []).map((tag) => pattern.replace(LANGUAGE_TAG, tag).replace(/^\.\//, '')) : [];
}

const MESSAGE_CALL = /\bm\.([A-Za-z_][\w]*)\(/;

function messageEdited(text: string, from: string, to: string, key: string | null): string | null {
  const needle = `${key ? JSON.stringify(key) : ''}: ${JSON.stringify(from)}`;
  const first = text.indexOf(needle);
  if (first < 0 || text.indexOf(needle, first + 1) >= 0) {
    return null;
  }
  const value = first + needle.length - JSON.stringify(from).length;
  return text.slice(0, value) + JSON.stringify(to) + text.slice(value + JSON.stringify(from).length);
}

function messageKeyIn(text: string, tag: Tag): string | null {
  const close = text.indexOf('</', tag.end + 1);
  return text.slice(tag.end + 1, close < 0 ? text.length : close).match(MESSAGE_CALL)?.[1] ?? null;
}

type Files = { read: ReadFile; cache: Map<string, string | null>; changed: Map<string, string> };

async function current(files: Files, path: string): Promise<string | null> {
  if (files.changed.has(path)) {
    return files.changed.get(path)!;
  }
  if (!files.cache.has(path)) {
    files.cache.set(path, await files.read(path).catch(() => null));
  }
  return files.cache.get(path)!;
}

async function textInCatalogue(files: Files, from: string, to: string, key: string | null): Promise<boolean> {
  for (const path of await catalogues(files.read)) {
    const text = await current(files, path);
    const next = text ? (messageEdited(text, from, to, key) ?? messageEdited(text, from, to, null)) : null;
    if (next) {
      files.changed.set(path, next);
      return true;
    }
  }
  return false;
}

type ClassRule = { make: (value: LookValue) => string; family: RegExp };

const arbitrary = (value: LookValue) => String(value).replace(/\s+/g, '_');
const TEXT_SIZES = /^text-(xs|sm|base|lg|[2-9]?xl|\[[\d.]+px\])$/;
const TEXT_OTHER = /^text-(left|right|center|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip)$/;

const CLASS_OF: Partial<Record<LookKey, ClassRule>> = {
  [LookKey.Fill]: { make: (v) => `bg-[${arbitrary(v)}]`, family: /^bg-(?!\[url|gradient)/ },
  [LookKey.Color]: { make: (v) => `text-[${arbitrary(v)}]`, family: /^text-/ },
  [LookKey.Size]: { make: (v) => `text-[${v}px]`, family: TEXT_SIZES },
  [LookKey.Gap]: { make: (v) => `gap-[${v}px]`, family: /^gap-(?!x-|y-)/ },
  [LookKey.Direction]: { make: (v) => (v === 'column' ? 'flex-col' : 'flex-row'), family: /^flex-(row|col)(-reverse)?$/ }
};

const VARIANT_PREFIX: Record<Scheme, string> = { [Scheme.Light]: '', [Scheme.Dark]: 'dark:' };

const sameFamily = (token: string, key: LookKey, prefix: string) => {
  if (!token.startsWith(prefix)) {
    return false;
  }
  const bare = token.slice(prefix.length);
  const rule = CLASS_OF[key]!;
  const isColor = key === LookKey.Color && !TEXT_SIZES.test(bare) && !TEXT_OTHER.test(bare);
  return !bare.includes(':') && (key === LookKey.Color ? isColor : rule.family.test(bare));
};

const CLASS_LITERAL = /(\s(?:class|className)=")([^"{}]*)"/;

function classed(text: string, tag: Tag, look: Look, prefix: string): string | null {
  const open = text.slice(tag.start, tag.end + 1);
  const found = open.match(CLASS_LITERAL);
  if (!found) {
    return null;
  }
  let tokens = found[2].split(/\s+/).filter(Boolean);
  for (const [key, value] of Object.entries(look)) {
    tokens = [...tokens.filter((t) => !sameFamily(t, key as LookKey, prefix)), `${prefix}${CLASS_OF[key as LookKey]!.make(value)}`];
  }
  const next = open.replace(CLASS_LITERAL, `$1${tokens.join(' ')}"`);
  return text.slice(0, tag.start) + next + text.slice(tag.end + 1);
}

const TAILWIND = /"tailwindcss"/;

async function usesTailwind(files: Files): Promise<boolean> {
  return TAILWIND.test((await current(files, 'package.json')) ?? '');
}

const cssOf = (look: Look): [string, string][] =>
  Object.entries(look).flatMap(([key, value]) => {
    const css = LOOK[key as LookKey]?.css;
    return css ? [css(value)] : [];
  });

async function styledFor(files: Files, text: string, tag: Tag, edit: SourceEdit, skipped: string[]): Promise<string> {
  const cond = parseKey(edit.cond);
  const where = label(edit.at);
  if (cond.width !== BASE_CONDITIONS.width) {
    skipped.push(`${where}: edited at ${cond.width}px, a rule for one width is not written`);
    return text;
  }

  const prefix = VARIANT_PREFIX[cond.scheme];
  const tailwind = await usesTailwind(files);
  if (prefix && !tailwind) {
    skipped.push(`${where}: edited under ${cond.scheme}, which needs Tailwind to be written as a ${prefix} class`);
    return text;
  }

  const visual = Object.fromEntries(Object.entries(edit.look).filter(([key]) => LOOK[key as LookKey]?.css)) as Look;
  const onClass = tailwind ? Object.fromEntries(Object.entries(visual).filter(([key]) => CLASS_OF[key as LookKey])) : {};
  const onStyle = Object.fromEntries(Object.entries(visual).filter(([key]) => !(key in onClass))) as Look;

  let next = text;
  const withClass = Object.keys(onClass).length ? classed(next, tag, onClass, prefix) : next;
  if (withClass === null) {
    skipped.push(`${where}: class is not a literal, ${Object.keys(onClass).join(', ')} not written`);
  } else {
    next = withClass;
  }

  const css = cssOf(onStyle);
  if (!css.length) {
    return next;
  }
  if (prefix) {
    skipped.push(`${where}: ${Object.keys(onStyle).join(', ')} has no ${prefix} class, not written`);
    return next;
  }
  const moved = tagFrom(next, tag.start)!;
  const withStyle = styled(next, moved, css, JSX_FILE.test(edit.at.file));
  if (withStyle) {
    return withStyle;
  }
  skipped.push(`${where}: style already set in code, not merged`);
  return next;
}

async function applyOne(files: Files, edit: SourceEdit, skipped: string[]): Promise<void> {
  const text = await current(files, edit.at.file);
  const tag = text ? tagAt(text, edit.at, edit.spot) : null;
  if (!text || !tag) {
    skipped.push(`${label(edit.at)}: the element is not where the import saw it`);
    return;
  }

  let next = await styledFor(files, text, tag, edit, skipped);

  const to = edit.look[LookKey.Text];
  const from = edit.was[LookKey.Text];
  if (typeof to === 'string' && typeof from === 'string') {
    const moved = tagFrom(next, tag.start)!;
    const literal = literalText(next, moved, from, to);
    if (literal) {
      next = literal;
    } else if (!(await textInCatalogue(files, from, to, messageKeyIn(next, moved)))) {
      skipped.push(`${label(edit.at)}: text "${from.slice(0, 40)}" comes from an expression`);
    }
  }

  if (next !== text) {
    files.changed.set(edit.at.file, next);
  }
}

export async function applyEdits(edits: SourceEdit[], read: ReadFile): Promise<Applied> {
  const files: Files = { read, cache: new Map(), changed: new Map() };
  const skipped: string[] = [];
  const ordered = [...edits].sort((a, b) => a.at.file.localeCompare(b.at.file) || b.at.line - a.at.line || b.at.column - a.at.column);
  for (const edit of ordered) {
    await applyOne(files, edit, skipped);
  }
  const changes = [...files.changed].map(([path, after]) => ({ path, before: files.cache.get(path) ?? '', after }));
  return { files: changes.filter((c) => c.before !== c.after), skipped };
}

export function unifiedDiff(path: string, before: string, after: string): string {
  const a = before.split('\n');
  const b = after.split('\n');
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) {
    head++;
  }
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) {
    tail++;
  }
  const from = Math.max(0, head - DIFF_CONTEXT);
  const lastA = a.length - (a[a.length - 1] === '' ? 1 : 0);
  const lastB = b.length - (b[b.length - 1] === '' ? 1 : 0);
  const untilA = Math.min(lastA, a.length - tail + DIFF_CONTEXT);
  const untilB = Math.min(lastB, b.length - tail + DIFF_CONTEXT);
  const lines = [...a.slice(from, head).map((l) => ` ${l}`), ...a.slice(head, a.length - tail).map((l) => `-${l}`), ...b.slice(head, b.length - tail).map((l) => `+${l}`), ...a.slice(a.length - tail, untilA).map((l) => ` ${l}`)];
  return `--- a/${path}\n+++ b/${path}\n@@ -${from + 1},${untilA - from} +${from + 1},${untilB - from} @@\n${lines.join('\n')}\n`;
}

export const patchOf = (files: FileChange[]) => files.map((f) => unifiedDiff(f.path, f.before, f.after)).join('');
