import { describe, expect, it } from 'vitest';
import { framesToWarm, WARM_MAX } from './warm-frames';

const view = { x: 0, y: 0, w: 1000, h: 800 };
const frame = (id: string, x: number, y: number, version = 1) => ({ id, x, y, w: 100, h: 100, version });

describe('quali frame scaldare a riposo', () => {
  it('solo quelli in vista, dal più vicino al centro', () => {
    const frames = [frame('far', 850, 650), frame('centre', 450, 350), frame('out', 2000, 0)];
    expect(framesToWarm(frames, view, new Map())).toEqual(['centre', 'far']);
  });

  it(`non più di ${WARM_MAX}`, () => {
    const frames = Array.from({ length: 20 }, (_, i) => frame(`f${i}`, i * 40, 300));
    expect(framesToWarm(frames, view, new Map())).toHaveLength(WARM_MAX);
  });

  it('un frame già scaldato alla stessa versione non si richiede; a una versione nuova sì', () => {
    const frames = [frame('a', 450, 350, 2), frame('b', 300, 300, 1)];
    expect(framesToWarm(frames, view, new Map([['a', 2], ['b', 0]]))).toEqual(['b']);
  });
});
