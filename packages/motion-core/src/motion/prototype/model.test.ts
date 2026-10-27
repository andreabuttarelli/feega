import { describe, expect, it } from 'vitest';
import { ActionKind, TransitionKind, TriggerKind, interactionSchema, needsTarget } from './model';

const parse = (input: unknown) => interactionSchema.safeParse(input);

describe('interactionSchema', () => {
  it('a click that navigates to a frame defaults to an instant transition', () => {
    const parsed = parse({ id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.Navigate, target: 'frame-b' } });

    expect(parsed.success && parsed.data.transition).toEqual({ kind: TransitionKind.Instant });
  });

  it('an after-delay trigger needs its delay', () => {
    expect(parse({ id: 'i1', trigger: { kind: TriggerKind.AfterDelay }, action: { kind: ActionKind.Back } }).success).toBe(false);
    expect(parse({ id: 'i1', trigger: { kind: TriggerKind.AfterDelay, delayMs: 800 }, action: { kind: ActionKind.Back } }).success).toBe(true);
  });

  it('navigate, overlay and scroll-to need a target; back does not', () => {
    for (const kind of [ActionKind.Navigate, ActionKind.OpenOverlay, ActionKind.ScrollTo]) {
      expect(parse({ id: 'i1', trigger: { kind: TriggerKind.Hover }, action: { kind } }).success).toBe(false);
      expect(needsTarget(kind)).toBe(true);
    }
    expect(parse({ id: 'i1', trigger: { kind: TriggerKind.Drag }, action: { kind: ActionKind.Back } }).success).toBe(true);
    expect(needsTarget(ActionKind.Back)).toBe(false);
  });

  it('a slide carries a direction, an easing and a duration', () => {
    const parsed = parse({
      id: 'i1',
      trigger: { kind: TriggerKind.Click },
      action: { kind: ActionKind.Navigate, target: 'frame-b' },
      transition: { kind: TransitionKind.Slide, direction: 'left', easing: 'enter', durationMs: 300 }
    });

    expect(parsed.success).toBe(true);
    expect(parse({ id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.Back }, transition: { kind: TransitionKind.Push, direction: 'sideways', durationMs: 300, easing: 'enter' } }).success).toBe(false);
  });

  it('rejects an unknown trigger and a non-positive duration', () => {
    expect(parse({ id: 'i1', trigger: { kind: 'shake' }, action: { kind: ActionKind.Back } }).success).toBe(false);
    expect(parse({ id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.Back }, transition: { kind: TransitionKind.Dissolve, easing: 'enter', durationMs: 0 } }).success).toBe(false);
  });

  it('smart animate takes an easing and a duration and defaults them', () => {
    const parsed = parse({ id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.Navigate, target: 'frame-b' }, transition: { kind: TransitionKind.SmartAnimate } });

    expect(parsed.success && parsed.data.transition).toEqual({ kind: TransitionKind.SmartAnimate, easing: 'standard', durationMs: 300 });
  });
});
