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

export function whenQuiet(busy: () => boolean, later: (again: () => void) => void = (again) => setTimeout(again, GESTURE_QUIET_MS)): Promise<void> {
  return new Promise((resolve) => {
    const check = () => (busy() ? later(check) : resolve());
    check();
  });
}
