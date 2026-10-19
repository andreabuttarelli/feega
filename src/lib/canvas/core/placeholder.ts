import type { Viewport } from '$lib/canvas/dot-grid';
import type { Screen } from '$lib/canvas/gpu/camera';
import { ItemKind, type DisplayList, type ImageItem, type Item } from '$lib/motion/gpu-full/display-list';
import type { Box } from './canvas-scene';
import type { HeldFrame } from './residency';
import type { CoreTheme } from './overlay';
import { line, rect, solid } from './shapes';

const BORDER = 1;
const BLANK = 'blank';

const block = (i: ImageItem, theme: CoreTheme): Item => ({ ...solid(i.clip, [rect(0, 0, i.size.width, i.size.height)], theme.line, i.opacity), matrix: i.matrix, ...(i.scissor ? { scissor: i.scissor } : {}) });

type Missing = (i: ImageItem) => boolean;

const blocked = (items: readonly Item[], theme: CoreTheme, missing: Missing): Item[] =>
  items.map((i) => {
    if (i.kind === ItemKind.Image && missing(i)) {
      return block(i, theme);
    }
    if (i.kind === ItemKind.Group) {
      return { ...i, items: blocked(i.items, theme, missing) };
    }
    return i;
  });

const ALL: Missing = () => true;

export const withoutPictures = (list: DisplayList, theme: CoreTheme, missing: Missing = ALL): DisplayList => ({ ...list, items: blocked(list.items, theme, missing) });

export const blankCard = (box: Box, theme: CoreTheme): DisplayList => ({
  width: box.w,
  height: box.h,
  background: null,
  unsupported: [],
  items: [solid(BLANK, [rect(0, 0, box.w, box.h)], theme.paper), solid(BLANK, line(rect(BORDER / 2, BORDER / 2, box.w - BORDER, box.h - BORDER), BORDER, true), theme.line)]
});

export function nearestFirst<T extends { box: Box }>(items: readonly T[], view: Viewport, area: Screen): T[] {
  const cx = (area.width / 2 - view.x) / view.zoom;
  const cy = (area.height / 2 - view.y) / view.zoom;
  const away = (b: Box) => Math.hypot(b.x + b.w / 2 - cx, b.y + b.h / 2 - cy);
  return [...items].sort((a, b) => away(a.box) - away(b.box));
}

export function choose(nodes: readonly (readonly HeldFrame[])[], uploaded: ReadonlySet<string>, budget: number): HeldFrame[] {
  let left = budget;
  return nodes.flatMap((layers) => {
    const ready = layers.findIndex((l) => uploaded.has(l.group));
    if (ready === 0) {
      return [layers[0]];
    }
    if (left > 0) {
      left -= 1;
      return [layers[0]];
    }
    return layers.length ? [layers[ready < 0 ? layers.length - 1 : ready]] : [];
  });
}
