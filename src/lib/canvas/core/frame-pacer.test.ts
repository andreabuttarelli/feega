import { describe, expect, it } from 'vitest';
import { FramePacer } from './frame-pacer';

function clock() {
  const queue: ((t: number) => void)[] = [];
  return { raf: (f: (t: number) => void) => queue.push(f), tick: (t: number) => queue.splice(0).forEach((f) => f(t)), pending: () => queue.length };
}

describe('frame pacer', () => {
  it('many changes inside one frame paint once', () => {
    const c = clock();
    let painted = 0;
    const pacer = new FramePacer(() => {
      painted++;
      return false;
    }, c.raf);
    pacer.invalidate();
    pacer.invalidate();
    pacer.invalidate();
    c.tick(16);
    expect(painted).toBe(1);
  });

  it('an idle canvas asks for no frames', () => {
    const c = clock();
    const pacer = new FramePacer(() => false, c.raf);
    pacer.invalidate();
    c.tick(16);
    expect(c.pending()).toBe(0);
  });

  it('a paint that asks for more keeps the loop alive until it settles', () => {
    const c = clock();
    let left = 3;
    const pacer = new FramePacer(() => --left > 0, c.raf);
    pacer.invalidate();
    c.tick(16);
    c.tick(32);
    c.tick(48);
    expect(left).toBe(0);
    expect(c.pending()).toBe(0);
  });
});
