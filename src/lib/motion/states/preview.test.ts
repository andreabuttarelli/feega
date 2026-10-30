import { describe, expect, it } from 'vitest';
import { MotionFormat, clipsOf, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { ElementState } from '@feega/motion-core/motion/states/model';
import { putState } from './ops';
import { previewDoc } from './preview';

function hovered() {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30 }, 'c1');
  const put = added.ok ? putState(added.doc, 'c1', { state: ElementState.Hover, overrides: { opacity: 0.4 } }) : added;
  if (!put.ok) {
    throw new Error(put.error);
  }
  return put.doc;
}

describe('state preview', () => {
  it('draws the picked clip in its state without touching the saved doc', () => {
    const doc = hovered();
    const shown = previewDoc(doc, { c1: { state: ElementState.Hover, amount: 1 } });

    expect(clipsOf(shown)[0].transform.opacity).toBe(0.4);
    expect(clipsOf(doc)[0].transform.opacity).toBeUndefined();
  });

  it('no picks returns the same doc', () => {
    const doc = hovered();
    expect(previewDoc(doc, {})).toBe(doc);
  });
});
