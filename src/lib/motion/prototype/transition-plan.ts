import { Direction, TransitionKind, type Transition } from '@feega/motion-core/motion/prototype/model';
import { easeCss } from '@feega/motion-core/motion/ease-css';

export type Pose = Record<string, string | number>;
export type TransitionPlan = { durationMs: number; easing: string; incoming: Pose[]; outgoing: Pose[] };

const FLIPPED: Record<Direction, Direction> = {
  [Direction.Left]: Direction.Right,
  [Direction.Right]: Direction.Left,
  [Direction.Up]: Direction.Down,
  [Direction.Down]: Direction.Up
};

const ENTERS_FROM: Record<Direction, string> = {
  [Direction.Left]: 'translate(100%, 0)',
  [Direction.Right]: 'translate(-100%, 0)',
  [Direction.Up]: 'translate(0, 100%)',
  [Direction.Down]: 'translate(0, -100%)'
};

const LEAVES_TO: Record<Direction, string> = {
  [Direction.Left]: 'translate(-100%, 0)',
  [Direction.Right]: 'translate(100%, 0)',
  [Direction.Up]: 'translate(0, -100%)',
  [Direction.Down]: 'translate(0, 100%)'
};

const REST = 'translate(0, 0)';

const NONE: TransitionPlan = { durationMs: 0, easing: 'linear', incoming: [], outgoing: [] };

export function transitionPlan(transition: Transition, reverse: boolean): TransitionPlan {
  if (transition.kind === TransitionKind.Instant) {
    return NONE;
  }
  const timing = { durationMs: transition.durationMs, easing: easeCss(transition.easing) };
  if (!('direction' in transition)) {
    return { ...timing, incoming: [{ opacity: 0 }, { opacity: 1 }], outgoing: [] };
  }
  const direction = reverse ? FLIPPED[transition.direction] : transition.direction;
  const incoming = [{ transform: ENTERS_FROM[direction] }, { transform: REST }];
  if (transition.kind === TransitionKind.Slide) {
    return { ...timing, incoming, outgoing: [] };
  }
  return { ...timing, incoming, outgoing: [{ transform: REST }, { transform: LEAVES_TO[direction] }] };
}
