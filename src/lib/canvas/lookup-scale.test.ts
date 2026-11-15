import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc } from '@feega/motion-core/motion/doc';
import { snapTargets } from '@feega/motion-core/motion/timeline';
import { counted } from './counted-list.testkit';
import { subtreeOf } from './core/lifted-drag';

const SIZE = 2000;
const PICKED = 50;

function flatDoc() {
  const base = newMotionDoc(MotionFormat.Landscape);
  const clips = counted(Array.from({ length: SIZE }, (_, i) => newClip({ id: `c${i}`, from: 0, durationInFrames: 30, component: 'Shape', props: {} })));
  return { doc: { ...base, tracks: [{ ...base.tracks[0], clips }] }, clips };
}

describe('lookups index their ids once', () => {
  it('collecting a dragged subtree scans no id list per clip', () => {
    const ids = counted(Array.from({ length: PICKED }, (_, i) => `c${i}`));

    const subtree = subtreeOf(flatDoc().doc, ids);

    expect(subtree.size).toBe(PICKED);
    expect(ids.scans()).toBe(0);
  });

  it('listing snap targets finds no clip by scanning the track', () => {
    const { doc, clips } = flatDoc();
    const exclude = counted(['c0', 'c1']);

    snapTargets(doc, { playhead: 0, exclude });

    expect(clips.scans()).toBe(0);
    expect(exclude.scans()).toBe(0);
  });
});
