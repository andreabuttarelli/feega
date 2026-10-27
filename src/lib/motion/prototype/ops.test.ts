import { describe, expect, it } from 'vitest';
import { MotionFormat, clipsOf, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { ActionKind, TriggerKind } from '@feega/motion-core/motion/prototype/model';
import { interactionsOf, putInteraction, removeInteraction } from './ops';

function docWithClip() {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30 }, 'c1');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

const click = { trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.Navigate, target: 'frame-b' } } as const;

describe('prototype ops', () => {
  it('putInteraction stores a link on the clip and interactionsOf lists it', () => {
    const put = putInteraction(docWithClip(), 'c1', { id: 'i1', ...click });

    expect(put.ok && interactionsOf(put.doc, 'c1')).toMatchObject([{ id: 'i1', action: { target: 'frame-b' } }]);
  });

  it('putting the same id again replaces the link instead of adding a second', () => {
    const first = putInteraction(docWithClip(), 'c1', { id: 'i1', ...click });
    const second = first.ok ? putInteraction(first.doc, 'c1', { id: 'i1', trigger: { kind: TriggerKind.Hover }, action: { kind: ActionKind.Back } }) : first;

    expect(second.ok && interactionsOf(second.doc, 'c1')).toMatchObject([{ id: 'i1', trigger: { kind: TriggerKind.Hover } }]);
  });

  it('removeInteraction drops one link and clears the field when none is left', () => {
    const put = putInteraction(docWithClip(), 'c1', { id: 'i1', ...click });
    const removed = put.ok ? removeInteraction(put.doc, 'c1', 'i1') : put;

    expect(removed.ok && interactionsOf(removed.doc, 'c1')).toEqual([]);
    expect(removed.ok && clipsOf(removed.doc)[0].interactions).toBeUndefined();
  });

  it('refuses a missing clip, a missing link and an invalid link', () => {
    const doc = docWithClip();

    expect(putInteraction(doc, 'nope', { id: 'i1', ...click })).toMatchObject({ ok: false });
    expect(removeInteraction(doc, 'c1', 'ghost')).toMatchObject({ ok: false });
    expect(putInteraction(doc, 'c1', { id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.Navigate } } as never)).toMatchObject({ ok: false });
  });
});
