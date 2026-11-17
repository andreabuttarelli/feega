export const GESTURE_QUIET_MS = 150;
export const GESTURE_QUIET_MIN_MS = 60;
const GAPS_OF_QUIET = 2;

const quietAfter = (gap: number) => (gap < GESTURE_QUIET_MS ? Math.min(GESTURE_QUIET_MS, Math.max(GESTURE_QUIET_MIN_MS, gap * GAPS_OF_QUIET)) : GESTURE_QUIET_MS);

export function gestureWatch(now: () => number = () => performance.now()) {
  let movedAt = -Infinity;
  let quiet = GESTURE_QUIET_MS;
  return {
    moved: () => {
      const at = now();
      quiet = quietAfter(at - movedAt);
      movedAt = at;
    },
    active: () => now() - movedAt < quiet
  };
}

export function whenQuiet(busy: () => boolean, later: (again: () => void) => void = (again) => setTimeout(again, GESTURE_QUIET_MS)): Promise<void> {
  return new Promise((resolve) => {
    const check = () => (busy() ? later(check) : resolve());
    check();
  });
}
