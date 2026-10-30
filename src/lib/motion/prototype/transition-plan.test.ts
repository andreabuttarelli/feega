import { describe, expect, it } from 'vitest';
import { Ease } from '@feega/motion-core/motion/design';
import { Direction, TransitionKind } from '@feega/motion-core/motion/prototype/model';
import { transitionPlan } from './transition-plan';

describe('transitionPlan', () => {
  it('instant takes no time', () => {
    expect(transitionPlan({ kind: TransitionKind.Instant }, false)).toEqual({ durationMs: 0, easing: 'linear', incoming: [], outgoing: [] });
  });

  it('dissolve fades the new frame in over the old one', () => {
    const plan = transitionPlan({ kind: TransitionKind.Dissolve, easing: Ease.Linear, durationMs: 400 }, false);

    expect(plan.durationMs).toBe(400);
    expect(plan.incoming).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(plan.outgoing).toEqual([]);
  });

  it('slide from the right moves only the new frame', () => {
    const plan = transitionPlan({ kind: TransitionKind.Slide, direction: Direction.Left, easing: Ease.Standard, durationMs: 300 }, false);

    expect(plan.incoming).toEqual([{ transform: 'translate(100%, 0)' }, { transform: 'translate(0, 0)' }]);
    expect(plan.outgoing).toEqual([]);
  });

  it('push moves the old frame out as the new one comes in', () => {
    const plan = transitionPlan({ kind: TransitionKind.Push, direction: Direction.Up, easing: Ease.Standard, durationMs: 300 }, false);

    expect(plan.incoming).toEqual([{ transform: 'translate(0, 100%)' }, { transform: 'translate(0, 0)' }]);
    expect(plan.outgoing).toEqual([{ transform: 'translate(0, 0)' }, { transform: 'translate(0, -100%)' }]);
  });

  it('reversed flips the direction', () => {
    const plan = transitionPlan({ kind: TransitionKind.Slide, direction: Direction.Left, easing: Ease.Standard, durationMs: 300 }, true);

    expect(plan.incoming[0]).toEqual({ transform: 'translate(-100%, 0)' });
  });

  it('uses the css curve of the chosen ease', () => {
    const plan = transitionPlan({ kind: TransitionKind.Dissolve, easing: Ease.Standard, durationMs: 300 }, false);

    expect(plan.easing).toMatch(/^cubic-bezier\(/);
  });
});

describe('a smart animate in the player', () => {
  it('cross-fades instead of sliding from an undefined direction', () => {
    const plan = transitionPlan({ kind: TransitionKind.SmartAnimate, easing: Ease.Standard, durationMs: 300 }, false);

    expect(plan.incoming).toEqual([{ opacity: 0 }, { opacity: 1 }]);
  });
});
