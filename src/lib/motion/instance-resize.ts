import type { MotionClip, MotionDoc } from '@feega/motion-core/motion/doc';
import { overridden } from '@feega/motion-core/motion/precomp';
import { setProps, type OpResult } from '@feega/motion-core/motion/timeline';
import { Sizing } from '@feega/motion-core/motion/layout/auto-layout';
import { DEFAULT_LAYOUT_ITEM } from '@feega/motion-core/motion/layout/model';
import { followParent, type Rect } from './constraints/constraints';
import { instanceOf, type Overrides } from './main-component';

export type Resize = { width?: number; height?: number };

const PLACED_KEYS = ['x', 'y', 'width', 'height'] as const;

const MIN_PX = 1;

const placed = (clip: MotionClip): boolean => PLACED_KEYS.every((k) => typeof clip.props[k] === 'number');

function rectOf(clip: MotionClip, space: { width: number; height: number }): Rect {
  const width = Number(clip.props.width) * space.width;
  const height = Number(clip.props.height) * space.height;
  return { left: Number(clip.props.x) * space.width - width / 2, top: Number(clip.props.y) * space.height - height / 2, width, height };
}

function moved(was: MotionClip, now: MotionClip): Record<string, unknown> {
  return Object.fromEntries(PLACED_KEYS.filter((k) => now.props[k] !== was.props[k]).map((k) => [k, now.props[k]]));
}

export function resizeInstance(doc: MotionDoc, clipId: string, shown: { width: number; height: number }, to: Resize): OpResult | null {
  const instance = instanceOf(doc, clipId);
  if (!instance) {
    return null;
  }
  const clips = overridden(instance.comp.tracks, instance.clip, instance.comp.component).flatMap((t) => t.clips as MotionClip[]);
  const roots = clips.filter((c) => !c.parent && !c.hidden);
  const [root] = roots;
  if (roots.length !== 1 || !placed(root) || shown.width <= 0 || shown.height <= 0) {
    return null;
  }

  const space = instance.comp.frame ?? { width: doc.width, height: doc.height };
  const from = rectOf(root, space);
  const width = to.width === undefined ? from.width : Math.max(MIN_PX, from.width * (to.width / shown.width));
  const height = to.height === undefined ? from.height : Math.max(MIN_PX, from.height * (to.height / shown.height));
  const next: Rect = { ...from, width, height };

  const item = root.autoLayout ? { layoutItem: { ...(root.layoutItem ?? DEFAULT_LAYOUT_ITEM), ...(to.width === undefined ? {} : { width: Sizing.Fixed }), ...(to.height === undefined ? {} : { height: Sizing.Fixed }) } } : {};
  const rootOwn = { x: (next.left + width / 2) / space.width, y: (next.top + height / 2) / space.height, width: width / space.width, height: height / space.height, ...item };
  const kids = root.autoLayout ? [] : clips.filter((c) => c.parent === root.id);
  const followed = kids.map((kid) => [kid.id, moved(kid, followParent(kid, space, from, next))] as const).filter(([, own]) => Object.keys(own).length);

  const overrides: Overrides = { ...instance.overrides, [root.id]: { ...instance.overrides[root.id], ...rootOwn } };
  for (const [id, own] of followed) {
    overrides[id] = { ...overrides[id], ...own };
  }
  return setProps(doc, clipId, { overrides });
}
