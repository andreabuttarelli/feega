import type { Viewport } from '$lib/canvas/dot-grid';
import type { Screen } from '$lib/canvas/gpu/camera';
import { AHEAD_REACH } from './screen-uses';
import type { SpatialIndex } from './spatial-index';

export type Sight = { onScreen: ReadonlySet<string>; near: ReadonlySet<string>; view: Viewport };

export const NO_SIGHT: Sight = { onScreen: new Set(), near: new Set(), view: { x: 0, y: 0, zoom: 1 } };

export const widened = (v: Viewport, a: Screen) => ({ view: { x: v.x + a.width * AHEAD_REACH, y: v.y + a.height * AHEAD_REACH, zoom: v.zoom }, area: { width: a.width * (1 + 2 * AHEAD_REACH), height: a.height * (1 + 2 * AHEAD_REACH) } });

export function sightOf(index: SpatialIndex, view: Viewport, area: Screen): Sight {
  const wide = widened(view, area);
  return { onScreen: index.visible(view, area), near: index.visible(wide.view, wide.area), view };
}

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((id) => b.has(id));

export const sameSight = (a: Sight, b: Sight) => sameSet(a.onScreen, b.onScreen) && sameSet(a.near, b.near);
