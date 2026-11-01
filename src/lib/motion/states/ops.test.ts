import { describe, expect, it } from 'vitest';
import { MotionFormat, clipsOf, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { ElementState } from '@feega/motion-core/motion/states/model';
import { Ease } from '@feega/motion-core/motion/design';
import { putState, removeState, statesOf } from './ops';

function docWithClip() {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30 }, 'c1');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

describe('state ops', () => {
  it('putState stores one row per state and replaces it on a second put', () => {
    const first = putState(docWithClip(), 'c1', { state: ElementState.Hover, overrides: { opacity: 0.5 } });
    const second = first.ok ? putState(first.doc, 'c1', { state: ElementState.Hover, overrides: { fill: '#ff0000' }, transition: { easing: Ease.Enter, durationMs: 400 } }) : first;

    expect(second.ok && statesOf(second.doc, 'c1')).toEqual([{ state: 'hover', overrides: { fill: '#ff0000' }, transition: { easing: 'enter', durationMs: 400 } }]);
  });

  it('removeState clears the field when no row is left', () => {
    const put = putState(docWithClip(), 'c1', { state: ElementState.Pressed, overrides: { scale: 0.96 } });
    const removed = put.ok ? removeState(put.doc, 'c1', ElementState.Pressed) : put;

    expect(removed.ok && clipsOf(removed.doc)[0].states).toBeUndefined();
  });

  it('refuses a missing clip and an invalid row', () => {
    expect(putState(docWithClip(), 'nope', { state: ElementState.Hover, overrides: {} }).ok).toBe(false);
    expect(putState(docWithClip(), 'c1', { state: ElementState.Hover, overrides: { opacity: 4 } }).ok).toBe(false);
  });
});
