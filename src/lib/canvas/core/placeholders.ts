import type { Viewport } from '$lib/canvas/dot-grid';
import type { Screen } from '$lib/canvas/gpu/camera';
import { ItemKind, type DisplayList, type ImageItem, type Item } from '$lib/motion/gpu-full/display-list';
import { rgbaOf, type Rgba } from '$lib/motion/gpu-full/rgba';
import type { Box } from './canvas-scene';
import { line, rect, solid } from './shapes';

export enum Stand {
  Card = 'card',
  Frame = 'frame'
}

export type Look = { paper: string; line: string };

type Size = { width: number; height: number };

const BLACK: Rgba = [0, 0, 0, 1];
const BORDER_PX = 1;

const LISTS: Record<Stand, (size: Size, look: Look) => DisplayList> = {
  [Stand.Card]: (size, look) => ({ ...size, background: rgbaOf(look.paper) ?? [1, 1, 1, 1], items: [solid('placeholder:border', line(rect(0, 0, size.width, size.height), BORDER_PX, true), look.line)], unsupported: [] }),
  [Stand.Frame]: (size) => ({ ...size, background: BLACK, items: [], unsupported: [] })
};

export function placeholder(stand: Stand, size: Size, look: Look): { group: string; list: DisplayList } {
  return { group: `placeholder:${stand}:${Math.round(size.width)}x${Math.round(size.height)}`, list: LISTS[stand](size, look) };
}

export const standIn = <T>(layers: readonly (T | null | undefined)[]): T | null => layers.find((l) => l != null) ?? null;

export const firstDrawn = <T extends { group: string }>(chain: readonly T[], drawn: ReadonlySet<string>): T | null => chain.find((l) => drawn.has(l.group)) ?? null;

export function lastShown<T extends { id: string }>(previous: ReadonlyMap<string, T>, ready: readonly T[], rebuilding: ReadonlySet<string>): Map<string, T> {
  const next = new Map(ready.map((f) => [f.id, f]));
  for (const id of rebuilding) {
    const old = previous.get(id);
    if (old && !next.has(id)) {
      next.set(id, old);
    }
  }
  return next;
}

export function fillOrder<T extends { box: Box }>(items: readonly T[], view: Viewport, screen: Screen): T[] {
  const centre = { x: (screen.width / 2 - view.x) / view.zoom, y: (screen.height / 2 - view.y) / view.zoom };
  const half = { w: screen.width / 2 / view.zoom, h: screen.height / 2 / view.zoom };
  const distance = (b: Box) => Math.hypot(b.x + b.w / 2 - centre.x, b.y + b.h / 2 - centre.y);
  const seen = (b: Box) => b.x + b.w >= centre.x - half.w && b.x <= centre.x + half.w && b.y + b.h >= centre.y - half.h && b.y <= centre.y + half.h;
  return items.filter((i) => seen(i.box)).sort((a, b) => distance(a.box) - distance(b.box));
}

type Missing = (i: ImageItem) => boolean;

const ALL: Missing = () => true;

const block = (i: ImageItem, look: Look): Item => ({ ...solid(i.clip, [rect(0, 0, i.size.width, i.size.height)], look.line, i.opacity), matrix: i.matrix, ...(i.scissor ? { scissor: i.scissor } : {}) });

const blocked = (items: readonly Item[], look: Look, missing: Missing): Item[] =>
  items.map((i) => {
    if (i.kind === ItemKind.Image && missing(i)) {
      return block(i, look);
    }
    if (i.kind === ItemKind.Group) {
      return { ...i, items: blocked(i.items, look, missing) };
    }
    return i;
  });

export const withoutPictures = (list: DisplayList, look: Look, missing: Missing = ALL): DisplayList => ({ ...list, items: blocked(list.items, look, missing) });
