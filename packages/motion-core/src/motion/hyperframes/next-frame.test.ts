import { describe, expect, it } from 'vitest';
import { nextFrame } from './next-frame';

const host = (hidden: boolean) => ({ document: { hidden }, requestAnimationFrame: () => 0 });

describe('nextFrame', () => {
  it('a hidden tab moves on without waiting for a requestAnimationFrame that never comes', async () => {
    await expect(Promise.race([nextFrame(host(true)), new Promise((_, ko) => setTimeout(() => ko(new Error('stalled')), 200))])).resolves.toBeUndefined();
  });

  it('a visible tab waits for the next paint', async () => {
    let paint: () => void = () => {};
    const visible = { document: { hidden: false }, requestAnimationFrame: (fn: () => void) => ((paint = fn), 1) };
    let passed = false;
    const waiting = nextFrame(visible).then(() => (passed = true));
    await new Promise((r) => setTimeout(r, 20));
    expect(passed).toBe(false);
    paint();
    await waiting;
    expect(passed).toBe(true);
  });
});
