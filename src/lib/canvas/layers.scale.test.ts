import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc, type MotionClip } from '@feega/motion-core/motion/doc';
import { frameRows } from './layers';

const SIZE = 2000;
const PARENT_READS_PER_CLIP = 10;

function watched(id: string, reads: { count: number }): MotionClip {
  const clip = newClip({ id, from: 0, durationInFrames: 30, component: 'Shape', props: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 } });
  Object.defineProperty(clip, 'parent', {
    get() {
      reads.count += 1;
      return null;
    }
  });
  return clip;
}

describe('layer rows', () => {
  it('read each clip parent a bounded number of times, not once per other clip', () => {
    const reads = { count: 0 };
    const base = newMotionDoc(MotionFormat.Landscape);
    const clips = Array.from({ length: SIZE }, (_, i) => watched(`c${i}`, reads));
    const doc = { ...base, tracks: [{ ...base.tracks[0], clips }] };

    const rows = frameRows(doc, 'm1');

    expect(rows.length).toBeGreaterThanOrEqual(SIZE);
    expect(reads.count).toBeLessThan(SIZE * PARENT_READS_PER_CLIP);
  });
});
