import { describe, expect, it } from 'vitest';
import { GESTURE_QUIET_MS, gestureWatch, whenQuiet } from './gesture-quiet';

describe('a gesture in progress', () => {
  it('is active right after the view moves', () => {
    let now = 1000;
    const watch = gestureWatch(() => now);
    watch.moved();
    now += GESTURE_QUIET_MS - 1;
    expect(watch.active()).toBe(true);
  });

  it('ends once the view has been still long enough', () => {
    let now = 1000;
    const watch = gestureWatch(() => now);
    watch.moved();
    now += GESTURE_QUIET_MS;
    expect(watch.active()).toBe(false);
  });

  it('is not active before anything moved', () => {
    expect(gestureWatch(() => 0).active()).toBe(false);
  });
});

describe('work that waits for the canvas to be still', () => {
  it('starts at once when nothing moves', async () => {
    await expect(whenQuiet(() => false, () => undefined)).resolves.toBeUndefined();
  });

  it('starts only after the edit or gesture is over', async () => {
    let busy = 3;
    const checks: number[] = [];
    await whenQuiet(
      () => busy > 0,
      (again) => {
        checks.push(busy--);
        again();
      }
    );
    expect(checks).toEqual([3, 2, 1]);
  });
});
