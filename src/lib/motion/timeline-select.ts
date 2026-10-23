import { findClip, type MotionDoc } from './doc';
import type { KeyRef } from './timeline';

export type Related = { layers: string[]; keys: KeyRef[] };

export type Box = { left: number; top: number; right: number; bottom: number };

export type KeyBox = { ref: KeyRef; box: Box };

export function relatedSelection(doc: MotionDoc, current: Related): Related {
  if (current.keys.length) {
    return { layers: [...new Set(current.keys.map((k) => k.clipId))], keys: [] };
  }
  const keys = current.layers.flatMap((id) => {
    const clip = findClip(doc, id)?.clip;
    return Object.entries(clip?.keyframes ?? {}).flatMap(([prop, track]) => track.map((k) => ({ clipId: id, prop, frame: k.frame })));
  });
  return { layers: keys.length ? [] : current.layers, keys };
}

const touches = (a: Box, b: Box) => a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;

const upright = (box: Box): Box => ({ left: Math.min(box.left, box.right), right: Math.max(box.left, box.right), top: Math.min(box.top, box.bottom), bottom: Math.max(box.top, box.bottom) });

export function marqueeHits(drag: Box, items: readonly KeyBox[]): KeyRef[] {
  const area = upright(drag);
  return items.filter((item) => touches(area, item.box)).map((item) => item.ref);
}
