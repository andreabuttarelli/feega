import { Place } from '@feega/live-edit/move-node';
import type { Pick, Source } from '../messages';
import type { Box } from './hint-boxes';

export type Drop = { target: Source; place: Place; line: Box };

const same = (a: Source | undefined, b: Source | undefined) => !!a && !!b && a.file === b.file && a.line === b.line && a.col === b.col;

const sideBySide = (a: Pick['rect'], b: Pick['rect']) => a.y < b.y + b.height && b.y < a.y + a.height;

export function dropOf(dragged: Pick, target: Pick, at: { x: number; y: number }): Drop | null {
  if (same(dragged.source, target.source) || !same(dragged.ancestors.at(-1)?.source, target.ancestors.at(-1)?.source)) {
    return null;
  }
  const r = target.rect;
  if (sideBySide(dragged.rect, r)) {
    const before = at.x < r.x + r.width / 2;
    return { target: target.source, place: before ? Place.Before : Place.After, line: { x: before ? r.x : r.x + r.width, y: r.y, w: 0, h: r.height } };
  }
  const before = at.y < r.y + r.height / 2;
  return { target: target.source, place: before ? Place.Before : Place.After, line: { x: r.x, y: before ? r.y : r.y + r.height, w: r.width, h: 0 } };
}
