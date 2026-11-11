import type { Viewport } from '$lib/canvas/dot-grid';
import type { Screen } from '$lib/canvas/gpu/camera';
import { ItemKind, type DisplayList, type ImageItem, type Item } from '@feega/motion-core/motion/gpu-full/display-list';
import { rgbaOf } from '@feega/motion-core/motion/gpu-full/rgba';
import { Readiness } from '@feega/motion-core/motion/gpu-full/media';
import type { Box } from './canvas-scene';
import { line, rect, solid } from './shapes';

export enum Stand {
  Card = 'card',
  Frame = 'frame'
}

export type Look = { paper: string; line: string };

type Size = { width: number; height: number };

const BORDER_PX = 1;

const LISTS: Record<Stand, (size: Size, look: Look) => DisplayList> = {
  [Stand.Card]: (size, look) => ({ ...size, background: rgbaOf(look.paper) ?? [1, 1, 1, 1], items: [solid('placeholder:border', line(rect(0, 0, size.width, size.height), BORDER_PX, true), look.line)], unsupported: [] }),
  [Stand.Frame]: (size) => ({ ...size, background: null, items: [], unsupported: [] })
};

const wholePixels = (size: Size): Size => ({ width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) });

export function placeholder(stand: Stand, size: Size, look: Look): { group: string; list: DisplayList } {
  const whole = wholePixels(size);
  return { group: `placeholder:${stand}:${whole.width}x${whole.height}`, list: LISTS[stand](whole, look) };
}

export const standIn = <T>(layers: readonly (T | null | undefined)[]): T | null => layers.find((l) => l != null) ?? null;

export const firstDrawn = <T extends { group: string }>(chain: readonly T[], drawn: ReadonlySet<string>): T | null => chain.find((l) => drawn.has(l.group)) ?? null;

export function fillOrder<T extends { box: Box }>(items: readonly T[], view: Viewport, screen: Screen): T[] {
  const centre = { x: (screen.width / 2 - view.x) / view.zoom, y: (screen.height / 2 - view.y) / view.zoom };
  const half = { w: screen.width / 2 / view.zoom, h: screen.height / 2 / view.zoom };
  const distance = (b: Box) => Math.hypot(b.x + b.w / 2 - centre.x, b.y + b.h / 2 - centre.y);
  const seen = (b: Box) => b.x + b.w >= centre.x - half.w && b.x <= centre.x + half.w && b.y + b.h >= centre.y - half.h && b.y <= centre.y + half.h;
  return items.filter((i) => seen(i.box)).sort((a, b) => distance(a.box) - distance(b.box));
}

export function nearestFirst<T extends { box: Box }>(items: readonly T[], view: Viewport, screen: Screen): T[] {
  const first = fillOrder(items, view, screen);
  const seen = new Set(first);
  const centre = { x: (screen.width / 2 - view.x) / view.zoom, y: (screen.height / 2 - view.y) / view.zoom };
  const distance = (b: Box) => Math.hypot(b.x + b.w / 2 - centre.x, b.y + b.h / 2 - centre.y);
  return [...first, ...items.filter((i) => !seen.has(i)).sort((a, b) => distance(a.box) - distance(b.box))];
}

export function onScreenFirst<T extends { box: Box }>(items: readonly T[], view: Viewport, screen: Screen): T[] {
  const first = fillOrder(items, view, screen);
  const seen = new Set(first);
  return [...first, ...items.filter((i) => !seen.has(i))];
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

export const drawable = (list: DisplayList, ready: Readiness, look: Look, missing: Missing): DisplayList => (ready === Readiness.Whole ? list : withoutPictures(list, look, missing));

type Layers<T> = { ready: T | null | undefined; poster?: T | null; before: T | null | undefined; thumb: T | null | undefined; blocks: T | null | undefined; placeholder: T };

export function layersOf<T extends { group: string }>({ ready, poster, before, thumb, blocks, placeholder }: Layers<T>): T[] {
  const seen = new Set<string>();
  return [ready, thumb, poster, before, blocks, placeholder].filter((l): l is T => {
    if (!l || seen.has(l.group)) {
      return false;
    }
    seen.add(l.group);
    return true;
  });
}
