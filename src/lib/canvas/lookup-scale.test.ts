import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc } from '@feega/motion-core/motion/doc';
import { counted } from './counted-list.testkit';
import { subtreeOf } from './core/lifted-drag';

const SIZE = 2000;
const PICKED = 50;

function flatDoc() {
  const base = newMotionDoc(MotionFormat.Landscape);
  const clips = Array.from({ length: SIZE }, (_, i) => newClip({ id: `c${i}`, from: 0, durationInFrames: 30, component: 'Shape', props: {} }));
  return { ...base, tracks: [{ ...base.tracks[0], clips }] };
}

describe('lookups index their ids once', () => {
  it('collecting a dragged subtree scans no id list per clip', () => {
    const ids = counted(Array.from({ length: PICKED }, (_, i) => `c${i}`));

    const subtree = subtreeOf(flatDoc(), ids);

    expect(subtree.size).toBe(PICKED);
    expect(ids.scans()).toBe(0);
  });
});
