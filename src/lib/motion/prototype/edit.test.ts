import { describe, expect, it } from 'vitest';
import { ActionKind, DEFAULT_OVERLAY, Direction, OverlayPosition, TransitionKind, TriggerKind, type Interaction } from '@feega/motion-core/motion/prototype/model';
import { TRANSITION_FIELDS, backdropOf, backdropParts, reoverlaid, retimed, retargeted, retriggered } from './edit';

const base: Interaction = { id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.Navigate, target: 'b' }, transition: { kind: TransitionKind.Instant } };

describe('inspector edits of an interaction', () => {
  it('switching to after-delay gives it a delay, and away from it drops the delay', () => {
    const delayed = retriggered(base, TriggerKind.AfterDelay);

    expect(delayed.trigger).toEqual({ kind: TriggerKind.AfterDelay, delayMs: 1000 });
    expect(retriggered(delayed, TriggerKind.Hover).trigger).toEqual({ kind: TriggerKind.Hover });
  });

  it('switching to back drops the target; switching to overlay keeps the given one', () => {
    expect(retargeted(base, ActionKind.Back, 'b').action).toEqual({ kind: ActionKind.Back });
    expect(retargeted(base, ActionKind.OpenOverlay, 'c').action).toEqual({ kind: ActionKind.OpenOverlay, target: 'c', overlay: DEFAULT_OVERLAY });
  });

  it('switching to change to drops the target and takes the picked variant', () => {
    expect(retargeted(base, ActionKind.ChangeTo, 'b', { State: 'Open' }).action).toEqual({ kind: ActionKind.ChangeTo, variant: { State: 'Open' } });
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

  it('switching a slide to smart animate drops the direction and keeps the timing', () => {
    const slid = retimed(base, { kind: TransitionKind.Slide, durationMs: 500 });

    expect(retimed(slid, { kind: TransitionKind.SmartAnimate }).transition).toEqual({ kind: TransitionKind.SmartAnimate, easing: 'standard', durationMs: 500 });
    expect(TRANSITION_FIELDS[TransitionKind.SmartAnimate]).toEqual({ direction: false, timing: true });
  });

  it('an overlay link keeps its position, outside click and backdrop when its target changes', () => {
    const overlay = { ...DEFAULT_OVERLAY, position: OverlayPosition.Bottom, closeOutside: false };
    const sheet: Interaction = { ...base, action: { kind: ActionKind.OpenOverlay, target: 'b', overlay } };

    expect(retargeted(sheet, ActionKind.OpenOverlay, 'c').action).toEqual({ kind: ActionKind.OpenOverlay, target: 'c', overlay });
  });

  it('changes one overlay setting and keeps the rest', () => {
    const sheet: Interaction = { ...base, action: { kind: ActionKind.OpenOverlay, target: 'b', overlay: DEFAULT_OVERLAY } };
    const manual = reoverlaid(sheet, { position: OverlayPosition.Manual, x: 20 });

    expect(manual.action).toEqual({ kind: ActionKind.OpenOverlay, target: 'b', overlay: { ...DEFAULT_OVERLAY, position: OverlayPosition.Manual, x: 20 } });
    expect(reoverlaid(manual, { backdrop: 'not a colour' })).toBe(manual);
    expect(reoverlaid(base, { closeOutside: false })).toBe(base);
  });

  it('switching to close overlay drops the target', () => {
    expect(retargeted(base, ActionKind.CloseOverlay, 'b').action).toEqual({ kind: ActionKind.CloseOverlay });
  });

  it('splits a backdrop into its colour and opacity and joins them back', () => {
    expect(backdropParts('#00000073')).toEqual({ colour: '#000000', opacity: 45 });
    expect(backdropParts('#1a2b3c')).toEqual({ colour: '#1a2b3c', opacity: 100 });
    expect(backdropOf('#1a2b3c', 45)).toBe('#1a2b3c73');
    expect(backdropOf('#1a2b3c', 140)).toBe('#1a2b3cff');
    expect(backdropOf('#1a2b3c', -3)).toBe('#1a2b3c00');
  });
});
