import { clipsOf, compsOf, everyClip, findClip, type MotionClip, type MotionDoc } from '@feega/motion-core/motion/doc';
import { BRAND_COLORS } from '@feega/motion-core/motion/components';
import { setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import { elementFills, fillReplaces } from '@feega/motion-core/motion/fill/elements';
import { elementStrokes, strokeReplaces } from '@feega/motion-core/motion/stroke/elements';

const HEX = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;

const TOKENS: ReadonlySet<string> = new Set(BRAND_COLORS);

export const isBrandToken = (colour: string) => TOKENS.has(colour);

const isColour = (value: string) => HEX.test(value) || TOKENS.has(value);

function coloursIn(value: unknown, into: string[]): string[] {
  if (typeof value === 'string' && isColour(value)) {
    into.push(value.toLowerCase());
    return into;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => coloursIn(v, into));
  }
  return into;
}

function swapped(value: unknown, from: string, to: string): unknown {
  if (typeof value === 'string') {
    return value.toLowerCase() === from ? to : value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => swapped(v, from, to));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, swapped(v, from, to)]));
  }
  return value;
}

function recolourTop(doc: MotionDoc, ids: readonly string[], target: string, to: string): OpResult {
  return ids.reduce<OpResult>((result, id) => {
    const clip = result.ok ? findClip(result.doc, id)?.clip : undefined;
    if (!result.ok || !clip || !coloursIn(clip.props, []).includes(target)) {
      return result;
    }
    return setProps(result.doc, id, swapped(clip.props, target, to) as Record<string, unknown>);
  }, { ok: true, doc });
}

function reachedComps(doc: MotionDoc, clips: readonly MotionClip[]): Set<string> {
  const reached = new Set<string>();
  const queue = clips.flatMap(compsOf);
  while (queue.length) {
    const id = queue.pop()!;
    if (reached.has(id) || !doc.comps[id]) {
      continue;
    }
    reached.add(id);
    queue.push(...doc.comps[id].tracks.flatMap((t) => (t.clips as MotionClip[]).flatMap(compsOf)));
  }
  return reached;
}

function scopeOf(doc: MotionDoc, ids: readonly string[]) {
  const top = ids.flatMap((id) => findClip(doc, id)?.clip ?? []);
  const comps = reachedComps(doc, top);
  const nested = [...comps].flatMap((id) => doc.comps[id].tracks.flatMap((t) => t.clips as MotionClip[]));
  return { top, comps, clips: [...top, ...nested] };
}

type Paint = { stack: string; replaces: (component: string, key: string) => boolean; legacy: (component: string, props: Record<string, unknown>) => unknown[] };

const PAINTS: readonly Paint[] = [
  { stack: 'fills', replaces: fillReplaces, legacy: elementFills },
  { stack: 'strokes', replaces: strokeReplaces, legacy: elementStrokes }
];

function painted(clip: MotionClip, key: string): boolean {
  const paint = PAINTS.find((p) => p.replaces(clip.component, key));
  if (!paint) {
    return true;
  }
  const value = clip.props[key];
  return clip.props[paint.stack] === undefined && typeof value === 'string' && coloursIn(paint.legacy(clip.component, clip.props), []).includes(value.toLowerCase());
}

const paintedProps = (clip: MotionClip) => Object.fromEntries(Object.entries(clip.props).filter(([key]) => painted(clip, key)));

export type ColourUse = { colour: string; count: number };

export function selectionColours(doc: MotionDoc, ids: readonly string[]): ColourUse[] {
  const counts = new Map<string, number>();
  for (const colour of scopeOf(doc, ids).clips.flatMap((clip) => coloursIn(paintedProps(clip), []))) {
    counts.set(colour, (counts.get(colour) ?? 0) + 1);
  }
  return [...counts].map(([colour, count]) => ({ colour, count })).sort((a, b) => b.count - a.count);
}

export function recolour(doc: MotionDoc, ids: readonly string[], from: string, to: string): OpResult {
  const target = from.toLowerCase();
  const { comps } = scopeOf(doc, ids);
  const top = recolourTop(doc, ids, target, to);
  if (!top.ok || !comps.size) {
    return top;
  }
  const swappedComps = Object.fromEntries(
    Object.entries(top.doc.comps).map(([id, comp]) => [id, comps.has(id) ? { ...comp, tracks: comp.tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c, props: swapped(c.props, target, to) as typeof c.props })) })) } : comp])
  );
  return { ok: true, doc: { ...top.doc, comps: swappedComps } };
}

const topIds = (doc: MotionDoc) => clipsOf(doc).map((clip) => clip.id);

export const frameColours = (doc: MotionDoc) => selectionColours(doc, topIds(doc));

export const recolourFrame = (doc: MotionDoc, from: string, to: string) => recolour(doc, topIds(doc), from, to);

const DOCUMENT_COLOURS_MAX = 16;
const BASE_LENGTH = 7;

export function documentColours(doc: MotionDoc): string[] {
  const uses = new Map<string, number>();
  for (const clip of everyClip(doc)) {
    for (const colour of coloursIn(paintedProps(clip), []).filter((c) => !TOKENS.has(c))) {
      const base = colour.slice(0, BASE_LENGTH);
      uses.set(base, (uses.get(base) ?? 0) + 1);
    }
  }
  return [...uses].sort((a, b) => b[1] - a[1]).slice(0, DOCUMENT_COLOURS_MAX).map(([colour]) => colour);
}
