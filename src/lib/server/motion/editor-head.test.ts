import { describe, expect, it } from 'vitest';
import { MotionFormat, newClip, newMotionDoc } from '@feega/motion-core/motion/doc';
import { DEFAULT_INTERACTIVE } from '@feega/motion-core/motion/interactive/settings';
import { headPatch } from './editor';

describe('the node data a saved revision writes', () => {
  it('says whether the frame is interactive, so the canvas offers Play without loading the doc', () => {
    const plain = newMotionDoc(MotionFormat.Landscape);
    expect(headPatch(plain, 3, 'n')).toMatchObject({ docHeadRevision: 3, interactive: false });
    expect(headPatch({ ...plain, interactive: DEFAULT_INTERACTIVE }, 4, 'n')).toMatchObject({ docHeadRevision: 4, interactive: true });
  });

  it('carries the colour of the page, so the canvas has something to show before the doc arrives', () => {
    const doc = newMotionDoc(MotionFormat.Landscape);
    const page = { ...doc, tracks: [{ ...doc.tracks[0], clips: [newClip({ id: 'bg', from: 0, durationInFrames: 30, component: 'Shape', props: { x: 0.5, y: 0.5, width: 1, height: 1, fill: '#07080a' } })] }, ...doc.tracks.slice(1)] };

    expect(headPatch(page, 2, 'n')).toMatchObject({ standInFill: '#07080a' });
  });
});
