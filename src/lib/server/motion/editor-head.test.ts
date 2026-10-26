import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { DEFAULT_INTERACTIVE } from '@feega/motion-core/motion/interactive/settings';
import { headPatch } from './editor';

describe('the node data a saved revision writes', () => {
  it('says whether the frame is interactive, so the canvas offers Play without loading the doc', () => {
    const plain = newMotionDoc(MotionFormat.Landscape);
    expect(headPatch(plain, 3)).toMatchObject({ docHeadRevision: 3, interactive: false });
    expect(headPatch({ ...plain, interactive: DEFAULT_INTERACTIVE }, 4)).toMatchObject({ docHeadRevision: 4, interactive: true });
  });
});
