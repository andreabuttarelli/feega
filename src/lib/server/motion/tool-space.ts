import type { MotionDoc } from '@feega/motion-core/motion/doc';
import { TrackType, type TrackSize } from '@feega/motion-core/motion/layout/auto-layout';
import type { AutoLayout, LayoutItem } from '@feega/motion-core/motion/layout/model';
import { spaceOf, type Frame } from '$lib/motion/units';

export const DOC_PX = 1;

const LAYOUT_PX = ['gap', 'crossGap'] as const;
const ITEM_PX = ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'] as const;
const TRACK_KEYS = ['columnTracks', 'rowTracks'] as const;

const PRECISION = 100;

type Sized = Pick<MotionDoc, 'width' | 'height'>;

type Px = (px: number) => number;

export type ToolSpace = {
  frame: Frame;
  toDoc: Px;
  toCanvas: Px;
  layoutIn: <T extends Partial<AutoLayout>>(layout: T) => T;
  layoutOut: <T extends Partial<AutoLayout>>(layout: T) => T;
  itemIn: <T extends Partial<LayoutItem>>(item: T) => T;
  itemOut: <T extends Partial<LayoutItem>>(item: T) => T;
};

const scaledTrack = (by: Px) => (track: TrackSize) => (track.type === TrackType.Fixed ? { ...track, value: by(track.value) } : track);

function scaledKeys<T extends object>(value: T, keys: readonly string[], by: Px): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  for (const key of keys) {
    if (typeof out[key] === 'number') {
      out[key] = by(out[key] as number);
    }
  }
  return out;
}

function scaledLayout<T extends Partial<AutoLayout>>(layout: T, by: Px): T {
  const out = scaledKeys(layout, LAYOUT_PX, by);
  if (layout.padding) {
    out.padding = scaledKeys(layout.padding, Object.keys(layout.padding), by);
  }
  for (const key of TRACK_KEYS) {
    out[key] = layout[key]?.map(scaledTrack(by));
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as T;
}

const scaledItem = <T extends Partial<LayoutItem>>(item: T, by: Px): T => scaledKeys(item, ITEM_PX, by) as T;

const tidy = (n: number) => Math.round(n * PRECISION) / PRECISION;

export function toolSpace(doc: Sized, scale: number): ToolSpace {
  const toDoc: Px = (px) => px / scale;
  const toCanvas: Px = (px) => tidy(px * scale);
  return {
    frame: spaceOf(doc, scale),
    toDoc,
    toCanvas,
    layoutIn: (layout) => scaledLayout(layout, toDoc),
    layoutOut: (layout) => scaledLayout(layout, toCanvas),
    itemIn: (item) => scaledItem(item, toDoc),
    itemOut: (item) => scaledItem(item, toCanvas)
  };
}
