export const GESTURE_QUIET_MS = 150;

export function gestureWatch(now: () => number = () => performance.now()) {
  let movedAt = -Infinity;
  return {
    moved: () => {
      movedAt = now();
    },
    active: () => now() - movedAt < GESTURE_QUIET_MS
  };
}
