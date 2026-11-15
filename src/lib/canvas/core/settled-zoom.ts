import { GESTURE_QUIET_MS } from './gesture-quiet';

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
