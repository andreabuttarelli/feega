import { describe, expect, it } from 'vitest';
import { ActionKind, Direction, TransitionKind, TriggerKind, type Interaction } from '@feega/motion-core/motion/prototype/model';
import { TRANSITION_FIELDS, retimed, retargeted, retriggered } from './edit';

const base: Interaction = { id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.Navigate, target: 'b' }, transition: { kind: TransitionKind.Instant } };

describe('inspector edits of an interaction', () => {
  it('switching to after-delay gives it a delay, and away from it drops the delay', () => {
    const delayed = retriggered(base, TriggerKind.AfterDelay);

    expect(delayed.trigger).toEqual({ kind: TriggerKind.AfterDelay, delayMs: 1000 });
    expect(retriggered(delayed, TriggerKind.Hover).trigger).toEqual({ kind: TriggerKind.Hover });
  });

  it('switching to back drops the target; switching to overlay keeps the given one', () => {
    expect(retargeted(base, ActionKind.Back, 'b').action).toEqual({ kind: ActionKind.Back });
    expect(retargeted(base, ActionKind.OpenOverlay, 'c').action).toEqual({ kind: ActionKind.OpenOverlay, target: 'c' });
  });

  it('switching the transition to slide fills direction, easing and duration; to instant strips them', () => {
    const slid = retimed(base, { kind: TransitionKind.Slide });

    expect(slid.transition).toEqual({ kind: TransitionKind.Slide, direction: Direction.Left, easing: 'standard', durationMs: 300 });
    expect(retimed(slid, { kind: TransitionKind.Instant }).transition).toEqual({ kind: TransitionKind.Instant });
    expect(retimed(slid, { durationMs: 500 }).transition).toMatchObject({ durationMs: 500, direction: Direction.Left });
  });

  it('says which transition kinds take a direction and a timing', () => {
    expect(TRANSITION_FIELDS[TransitionKind.Instant]).toEqual({ direction: false, timing: false });
    expect(TRANSITION_FIELDS[TransitionKind.Dissolve]).toEqual({ direction: false, timing: true });
    expect(TRANSITION_FIELDS[TransitionKind.Push]).toEqual({ direction: true, timing: true });
  });
});
