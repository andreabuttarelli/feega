import type { Viewport } from '$lib/canvas/dot-grid';
import type { Screen } from '$lib/canvas/gpu/camera';
import { cacheZoom } from './residency';
import { AHEAD_REACH } from './screen-uses';
import type { SpatialIndex } from './spatial-index';

export type Sight = { onScreen: ReadonlySet<string>; near: ReadonlySet<string>; view: Viewport };

export type Taken = { view: Viewport; area: Screen };

export const NO_SIGHT: Sight = { onScreen: new Set(), near: new Set(), view: { x: 0, y: 0, zoom: 1 } };

export const SIGHT_SLACK = 0.25;

export const grown = (v: Viewport, a: Screen, by: number) => ({ view: { x: v.x + a.width * by, y: v.y + a.height * by, zoom: v.zoom }, area: { width: a.width * (1 + 2 * by), height: a.height * (1 + 2 * by) } });

export const widened = (v: Viewport, a: Screen) => grown(v, a, AHEAD_REACH);

export const slackened = (v: Viewport, a: Screen) => grown(v, a, SIGHT_SLACK);

export function sightOf(index: SpatialIndex, view: Viewport, area: Screen): Sight {
  const seen = slackened(view, area);
  const wide = grown(view, area, AHEAD_REACH + SIGHT_SLACK);
  return { onScreen: index.visible(seen.view, seen.area), near: index.visible(wide.view, wide.area), view };
}

const worldOf = ({ view, area }: Taken) => ({ left: -view.x / view.zoom, top: -view.y / view.zoom, right: (area.width - view.x) / view.zoom, bottom: (area.height - view.y) / view.zoom });

export function stillHolds(taken: Taken, view: Viewport, area: Screen): boolean {
  if (cacheZoom(taken.view.zoom) !== cacheZoom(view.zoom)) {
    return false;
  }

  const reach = worldOf(slackened(taken.view, taken.area));
  const now = worldOf({ view, area });
  return now.left >= reach.left && now.top >= reach.top && now.right <= reach.right && now.bottom <= reach.bottom;
}

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((id) => b.has(id));

export const sameSight = (a: Sight, b: Sight) => sameSet(a.onScreen, b.onScreen) && sameSet(a.near, b.near);
