import { describe, expect, it } from 'vitest';
import { Fling } from './inertia';

describe('pan inertia', () => {
  it('a flick keeps gliding in its direction and comes to rest', () => {
    const fling = new Fling();
    fling.sample({ x: 0, y: 0 }, 0);
    fling.sample({ x: 20, y: 0 }, 16);
    fling.sample({ x: 40, y: 0 }, 32);
    const glide = fling.release(32);
    let moved = 0;
    let frames = 0;
    for (let step = glide.step(16); step; step = glide.step(16)) {
      moved += step.x;
      frames++;
    }
    expect(moved).toBeGreaterThan(100);
    expect(frames).toBeLessThan(120);
  });

  it('a pointer held still before release does not glide', () => {
    const fling = new Fling();
    fling.sample({ x: 0, y: 0 }, 0);
    fling.sample({ x: 40, y: 0 }, 16);
    fling.sample({ x: 40, y: 0 }, 200);
    expect(fling.release(200).step(16)).toBeNull();
  });
});
