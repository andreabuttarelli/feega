import { describe, expect, it } from 'vitest';
import { TransitionKind } from '../design';
import { edgeAt, moveAt, SHOWN } from './edges';

const clip = (kind: TransitionKind, side: 'transitionIn' | 'transitionOut') => ({ from: 30, durationInFrames: 60, transitionIn: { kind: TransitionKind.None, durationInFrames: 0 }, transitionOut: { kind: TransitionKind.None, durationInFrames: 0 }, [side]: { kind, durationInFrames: 10 }, props: {} });

describe('edgeAt', () => {
  it('starts an entrance hidden and ends it shown', () => {
    expect(edgeAt(clip(TransitionKind.SlideUp, 'transitionIn'), 30)).toMatchObject({ opacity: 0, y: 0.12 });
    expect(edgeAt(clip(TransitionKind.SlideUp, 'transitionIn'), 40)).toEqual(SHOWN);
  });

  it('hides an exit by the last frame', () => {
    const wipe = clip(TransitionKind.Wipe, 'transitionOut');

    expect(edgeAt(wipe, 79)).toEqual(SHOWN);
    expect(edgeAt(wipe, 90).wipe).toBeCloseTo(1);
    expect(edgeAt(wipe, 85).wipe).toBeGreaterThan(0);
  });

  it('blurs and scales the kinds that do', () => {
    expect(edgeAt(clip(TransitionKind.Blur, 'transitionIn'), 30)).toMatchObject({ blur: 24, opacity: 0 });
    expect(edgeAt(clip(TransitionKind.Scale, 'transitionIn'), 30)).toMatchObject({ scale: 0.86 });
  });
});

describe('moveAt', () => {
  it('drifts a picture up over the whole clip', () => {
    const drift = { ...clip(TransitionKind.None, 'transitionIn'), props: { move: 'drift-up', easing: 'linear' } };

    expect(moveAt(drift, 30)).toMatchObject({ y: 0.06, scale: 1 });
    expect(moveAt(drift, 60).y).toBeCloseTo(0.03, 2);
  });
});
