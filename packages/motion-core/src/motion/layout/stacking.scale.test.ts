import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc, type MotionClip } from '../doc';
import { DEFAULT_AUTO_LAYOUT } from './model';
import { withStacking } from './stacking';

const SIZE = 2000;

function scanCounter() {
  let scans = 0;
  const watched = (clips: MotionClip[]) => {
    const list = [...clips];
    Object.defineProperty(list, 'some', {
      value: (...args: Parameters<MotionClip[]['some']>) => {
        scans += 1;
        return Array.prototype.some.apply(list, args);
      }
    });
    return list;
  };
  return { watched, scans: () => scans };
}

const clip = (id: string, over: Partial<MotionClip> = {}) => newClip({ id, from: 0, durationInFrames: 30, component: 'Shape', props: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 }, ...over });

describe('withStacking', () => {
  it('finds the track of each child without scanning the tracks once per child', () => {
    const counter = scanCounter();
    const ids = Array.from({ length: SIZE }, (_, i) => `k${i}`);
    const kids = ids.map((id) => clip(id, { parent: 'c' }));
    const box = clip('c', { autoLayout: { ...DEFAULT_AUTO_LAYOUT, order: [...ids].reverse(), firstOnTop: true } });
    const base = newMotionDoc(MotionFormat.Square);
    const tracks = [...kids, box].map((c) => ({ id: `t-${c.id}`, kind: base.tracks[0].kind, name: '', clips: counter.watched([c]) }));

    const stacked = withStacking({ ...base, tracks });

    expect(stacked.tracks).toHaveLength(SIZE + 1);
    expect(counter.scans()).toBeLessThan(SIZE * 4);
  });
});
