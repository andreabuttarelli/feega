import { describe, expect, it } from 'vitest';
import { ActionKind, DEFAULT_OVERLAY, OverlayPosition, TransitionKind, TriggerKind, interactionSchema, needsTarget } from './model';

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

  it('change to carries the variant it picks and no target', () => {
    const parsed = parse({ id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.ChangeTo, variant: { State: 'Open' } } });

    expect(parsed.success && parsed.data.action).toEqual({ kind: ActionKind.ChangeTo, variant: { State: 'Open' } });
    expect(needsTarget(ActionKind.ChangeTo)).toBe(false);
    expect(parse({ id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.ChangeTo, variant: {} } }).success).toBe(false);
  });

  it('an overlay opens centred, closes on a click outside and dims what is behind it, unless told otherwise', () => {
    const parsed = parse({ id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.OpenOverlay, target: 'sheet' } });

    expect(parsed.success && parsed.data.action).toEqual({ kind: ActionKind.OpenOverlay, target: 'sheet', overlay: DEFAULT_OVERLAY });
    expect(DEFAULT_OVERLAY).toEqual({ position: OverlayPosition.Center, x: 0, y: 0, closeOutside: true, backdrop: '#00000073' });
  });

  it('an overlay keeps a manual position, its outside-click choice and its backdrop colour', () => {
    const overlay = { position: OverlayPosition.Manual, x: 24, y: 120, closeOutside: false, backdrop: '#ffffff00' };
    const parsed = parse({ id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.OpenOverlay, target: 'sheet', overlay } });

    expect(parsed.success && parsed.data.action).toEqual({ kind: ActionKind.OpenOverlay, target: 'sheet', overlay });
    expect(parse({ id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.OpenOverlay, target: 'sheet', overlay: { backdrop: 'grey' } } }).success).toBe(false);
  });

  it('close overlay needs no target', () => {
    expect(parse({ id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.CloseOverlay } }).success).toBe(true);
    expect(needsTarget(ActionKind.CloseOverlay)).toBe(false);
  });

  it('open url keeps an http link and refuses any other scheme', () => {
    const parsed = parse({ id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.OpenUrl, url: 'https://feega.app/pricing' } });

    expect(parsed.success && parsed.data.action).toEqual({ kind: ActionKind.OpenUrl, url: 'https://feega.app/pricing' });
    expect(needsTarget(ActionKind.OpenUrl)).toBe(false);
    expect(parse({ id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.OpenUrl, url: 'javascript:alert(1)' } }).success).toBe(false);
    expect(parse({ id: 'i1', trigger: { kind: TriggerKind.Click }, action: { kind: ActionKind.OpenUrl, url: 'not a url' } }).success).toBe(false);
  });
});
