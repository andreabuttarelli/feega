import { describe, expect, it } from 'vitest';
import { GESTURE_QUIET_MS, gestureWatch } from './gesture-quiet';

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
