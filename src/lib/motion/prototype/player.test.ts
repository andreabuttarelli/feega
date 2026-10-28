import { describe, expect, it } from 'vitest';
import { Ease } from '@feega/motion-core/motion/design';
import { ActionKind, Direction, TransitionKind } from '@feega/motion-core/motion/prototype/model';
import { MoveKind, act, closeTopOverlay, startPlayer } from './player';

const known = new Set(['a', 'b', 'c', 'modal']);
const slide = { kind: TransitionKind.Slide, direction: Direction.Left, easing: Ease.Standard, durationMs: 300 } as const;
const instant = { kind: TransitionKind.Instant } as const;

describe('player', () => {
  it('starts on the start frame with nothing behind it', () => {
    expect(startPlayer('a')).toEqual({ current: 'a', history: [], overlays: [] });
  });

  it('navigate moves to the target and remembers where it came from', () => {
    const step = act(startPlayer('a'), { kind: ActionKind.Navigate, target: 'b' }, slide, known);

    expect(step.state).toEqual({ current: 'b', history: [{ frame: 'a', transition: slide }], overlays: [] });
    expect(step.move).toEqual({ kind: MoveKind.Enter, from: 'a', to: 'b', transition: slide, reverse: false });
  });

  it('back returns to the previous frame with the transition reversed', () => {
    const there = act(startPlayer('a'), { kind: ActionKind.Navigate, target: 'b' }, slide, known).state;
    const back = act(there, { kind: ActionKind.Back }, instant, known);

    expect(back.state).toEqual(startPlayer('a'));
    expect(back.move).toEqual({ kind: MoveKind.Enter, from: 'b', to: 'a', transition: slide, reverse: true });
  });

  it('back with nowhere to go does nothing', () => {
    const step = act(startPlayer('a'), { kind: ActionKind.Back }, instant, known);

    expect(step).toEqual({ state: startPlayer('a'), move: null });
  });

  it('a link to a frame that is gone does nothing', () => {
    const step = act(startPlayer('a'), { kind: ActionKind.Navigate, target: 'ghost' }, instant, known);

    expect(step).toEqual({ state: startPlayer('a'), move: null });
  });

  it('navigating to the frame already shown does nothing', () => {
    expect(act(startPlayer('a'), { kind: ActionKind.Navigate, target: 'a' }, instant, known).move).toBeNull();
  });

  it('an overlay opens over the current frame and back closes it first', () => {
    const open = act(startPlayer('a'), { kind: ActionKind.OpenOverlay, target: 'modal' }, instant, known);

    expect(open.state).toEqual({ current: 'a', history: [], overlays: ['modal'] });
    expect(open.move).toMatchObject({ kind: MoveKind.Open, to: 'modal' });

    const closed = act(open.state, { kind: ActionKind.Back }, instant, known);

    expect(closed.state).toEqual(startPlayer('a'));
    expect(closed.move).toMatchObject({ kind: MoveKind.Close, from: 'modal', reverse: true });
  });

  it('navigating from under an overlay drops the overlays', () => {
    const open = act(startPlayer('a'), { kind: ActionKind.OpenOverlay, target: 'modal' }, instant, known).state;
    const moved = act(open, { kind: ActionKind.Navigate, target: 'b' }, instant, known);

    expect(moved.state.overlays).toEqual([]);
    expect(moved.state.current).toBe('b');
  });

  it('scroll to a frame lands on it like a navigation', () => {
    const step = act(startPlayer('a'), { kind: ActionKind.ScrollTo, target: 'c' }, instant, known);

    expect(step.state.current).toBe('c');
  });

  it('closeTopOverlay closes an overlay and leaves a bare frame alone', () => {
    const open = act(startPlayer('a'), { kind: ActionKind.OpenOverlay, target: 'modal' }, instant, known).state;

    expect(closeTopOverlay(open).state.overlays).toEqual([]);
    expect(closeTopOverlay(startPlayer('a')).move).toBeNull();
  });
});
