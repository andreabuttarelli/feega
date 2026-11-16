import { GESTURE_QUIET_MS } from './gesture-quiet';
import { strokeZoomStep } from './label-size';

export enum Chrome {
  Selected = 'selected',
  Resting = 'resting'
}

const STROKE_ZOOM_OF: Record<Chrome, (held: number, zoom: number) => number> = {
  [Chrome.Selected]: (_held, zoom) => strokeZoomStep(zoom),
  [Chrome.Resting]: (held) => held
};

export const strokeZoomOf = (chrome: Chrome, held: number, zoom: number): number => STROKE_ZOOM_OF[chrome](held, zoom);

export function settledZoom(step: (zoom: number) => number, now: () => number, zoom: number) {
  let seen = zoom;
  let movedAt = -Infinity;
  let held = step(zoom);

  return {
    at(next: number): number {
      if (next !== seen) {
        seen = next;
        movedAt = now();
      }
      if (now() - movedAt >= GESTURE_QUIET_MS) {
        held = step(next);
      }
      return held;
    }
  };
}
