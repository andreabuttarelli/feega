import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc } from '../doc';
import { buildPage } from './build';

const SIZE = 1000;
const PARENT_READS_PER_CLIP = 20;

describe('buildPage', () => {
  it('reads each clip parent a bounded number of times, not once per other clip', () => {
    let reads = 0;
    const clips = Array.from({ length: SIZE }, (_, i) => {
      const clip = newClip({ id: `c${i}`, from: 0, durationInFrames: 30, component: 'Shape', props: { x: 0.5, y: 0.5, width: 0.1, height: 0.1 } });
      Object.defineProperty(clip, 'parent', {
        get() {
          reads += 1;
          return null;
        }
      });
      return clip;
    });
    const base = newMotionDoc(MotionFormat.Landscape);
    const doc = { ...base, tracks: [{ ...base.tracks[0], clips }] };

    buildPage({ doc, name: 'Page', assets: {}, assetBase: '', brand: null });

    expect(reads).toBeLessThan(SIZE * PARENT_READS_PER_CLIP);
  });
});
