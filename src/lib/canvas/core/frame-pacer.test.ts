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

  it('a gpu still busy with earlier frames skips the paint but keeps the loop alive', () => {
    const c = clock();
    let painted = 0;
    let busy = true;
    const pacer = new FramePacer(
      () => {
        painted++;
        return false;
      },
      c.raf,
      () => busy
    );
    pacer.invalidate();
    c.tick(16);
    c.tick(32);
    expect(painted).toBe(0);
    expect(c.pending()).toBe(1);
    busy = false;
    c.tick(48);
    expect(painted).toBe(1);
    expect(c.pending()).toBe(0);
  });

  it('work waiting for the paint runs after the frame that drew, not before', () => {
    const c = clock();
    const later: (() => void)[] = [];
    const seen: string[] = [];
    const pacer = new FramePacer(
      () => {
        seen.push('paint');
        return false;
      },
      c.raf,
      () => false,
      (job) => later.push(job)
    );
    pacer.afterPaint(() => seen.push('fit text'));
    expect(seen).toEqual([]);
    c.tick(16);
    later.splice(0).forEach((job) => job());
    expect(seen).toEqual(['paint', 'fit text']);
  });

  it('work waiting for the paint waits out the frames a busy gpu skips', () => {
    const c = clock();
    const later: (() => void)[] = [];
    let busy = true;
    let fitted = 0;
    const pacer = new FramePacer(
      () => false,
      c.raf,
      () => busy,
      (job) => later.push(job)
    );
    pacer.afterPaint(() => fitted++);
    c.tick(16);
    later.splice(0).forEach((job) => job());
    expect(fitted).toBe(0);
    busy = false;
    c.tick(32);
    later.splice(0).forEach((job) => job());
    expect(fitted).toBe(1);
  });
});
