import { describe, expect, it } from 'vitest';
import { MotionFormat, findClip, newMotionDoc } from '$lib/motion/doc';
import { addClip } from '$lib/motion/timeline';
import { Grip } from '$lib/motion/scene-select';
import { dragClip } from './frame-transform';

const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 900, props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.2, height: 0.2 } }, 'card');
if (!added.ok) {
  throw new Error(added.error);
}
const BOX = { left: 768, top: 432, width: 384, height: 216 };

describe('dragClip', () => {
  it('moves the clip by the drag distance', () => {
    const result = dragClip({ doc: added.doc, clipId: 'card', frame: 0, box: BOX, grip: Grip.Move, handle: 0, from: [900, 500], to: [1000, 560] });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(findClip(result.doc, 'card')).not.toEqual(findClip(added.doc, 'card'));
    }
  });

  it('scales the clip from a corner handle', () => {
    const result = dragClip({ doc: added.doc, clipId: 'card', frame: 0, box: BOX, grip: Grip.Scale, handle: 2, from: [1152, 648], to: [1344, 756] });

    expect(result.ok && result.doc).not.toBe(added.doc);
  });

  it('refuses a clip that is not in the doc', () => {
    expect(dragClip({ doc: added.doc, clipId: 'gone', frame: 0, box: BOX, grip: Grip.Move, handle: 0, from: [0, 0], to: [1, 1] }).ok).toBe(false);
  });
});
