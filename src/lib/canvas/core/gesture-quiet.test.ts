import { describe, expect, it } from 'vitest';
import { GESTURE_QUIET_MIN_MS, GESTURE_QUIET_MS, gestureWatch, whenQuiet } from './gesture-quiet';

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

  it('ends sooner when the view moves every frame', () => {
    expect(GESTURE_QUIET_MIN_MS).toBeLessThan(GESTURE_QUIET_MS);
    let now = 1000;
    const watch = gestureWatch(() => now);
    for (let i = 0; i < 3; i++) {
      watch.moved();
      now += 8;
    }
    now += GESTURE_QUIET_MIN_MS - 8;
    expect(watch.active()).toBe(false);
  });

  it('holds for a slow gesture whose moves come far apart', () => {
    let now = 1000;
    const watch = gestureWatch(() => now);
    watch.moved();
    now += 70;
    watch.moved();
    now += 100;
    expect(watch.active()).toBe(true);
  });

  it('keeps the full window once a gesture resumes after a short pause', () => {
    let now = 1000;
    const watch = gestureWatch(() => now);
    for (let i = 0; i < 3; i++) {
      watch.moved();
      now += 8;
    }
    now += 100;
    watch.moved();
    watch.moved();
    now += GESTURE_QUIET_MS - 1;
    expect(watch.active()).toBe(true);
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
