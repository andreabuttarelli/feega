import type { Viewport } from '$lib/canvas/dot-grid';
import type { Screen } from '$lib/canvas/gpu/camera';
import { AHEAD_REACH } from './screen-uses';

export const widened = (v: Viewport, a: Screen) => ({ view: { x: v.x + a.width * AHEAD_REACH, y: v.y + a.height * AHEAD_REACH, zoom: v.zoom }, area: { width: a.width * (1 + 2 * AHEAD_REACH), height: a.height * (1 + 2 * AHEAD_REACH) } });
