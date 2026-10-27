import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from '@feega/motion-core/motion/doc';
import { addClip } from '@feega/motion-core/motion/timeline';
import { Ease } from '@feega/motion-core/motion/design';
import { ActionKind, TransitionKind, TriggerKind } from '@feega/motion-core/motion/prototype/model';
import { interactionsOf, putInteraction } from './ops';
import { linkToFrame } from './link-draft';

function docWithClip() {
  const added = addClip(newMotionDoc(MotionFormat.Landscape), { component: 'Shape', from: 0, durationInFrames: 30 }, 'c1');
  if (!added.ok) {
    throw new Error(added.error);
  }
  return added.doc;
}

describe('linkToFrame', () => {
  it('a new link is a click that navigates instantly to the picked frame', () => {
    const linked = linkToFrame(docWithClip(), { clipId: 'c1', interactionId: null }, 'frame-b', () => 'i1');

    expect(linked.ok && interactionsOf(linked.doc, 'c1')).toEqual([{ id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.Navigate, target: 'frame-b' }, transition: { kind: TransitionKind.Instant } }]);
  });

  it('re-aiming an existing link keeps its trigger, kind and transition', () => {
    const base = putInteraction(docWithClip(), 'c1', { id: 'i1', trigger: { kind: TriggerKind.Hover }, action: { kind: ActionKind.OpenOverlay, target: 'frame-b' }, transition: { kind: TransitionKind.Dissolve, easing: Ease.Enter, durationMs: 200 } });
    const moved = base.ok ? linkToFrame(base.doc, { clipId: 'c1', interactionId: 'i1' }, 'frame-c', () => 'x') : base;

    expect(moved.ok && interactionsOf(moved.doc, 'c1')).toMatchObject([{ id: 'i1', trigger: { kind: TriggerKind.Hover }, action: { kind: ActionKind.OpenOverlay, target: 'frame-c' }, transition: { kind: TransitionKind.Dissolve, durationMs: 200 } }]);
  });

  it('a back link turned into a frame link becomes a navigate', () => {
    const base = putInteraction(docWithClip(), 'c1', { id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.Back } });
    const moved = base.ok ? linkToFrame(base.doc, { clipId: 'c1', interactionId: 'i1' }, 'frame-c', () => 'x') : base;

    expect(moved.ok && interactionsOf(moved.doc, 'c1')).toMatchObject([{ action: { kind: ActionKind.Navigate, target: 'frame-c' } }]);
  });
});
