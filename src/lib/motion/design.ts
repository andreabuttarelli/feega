export const FPS = 30;

export enum Ease {
  Standard = 'standard',
  Enter = 'enter',
  Exit = 'exit',
  Linear = 'linear',
  Overshoot = 'overshoot'
}

export const EASE_IDS = [Ease.Standard, Ease.Enter, Ease.Exit, Ease.Linear, Ease.Overshoot] as const;

type Bezier = readonly [number, number, number, number];

const BEZIERS: Record<Ease, Bezier> = {
  [Ease.Standard]: [0.2, 0, 0, 1],
  [Ease.Enter]: [0, 0, 0.2, 1],
  [Ease.Exit]: [0.4, 0, 1, 1],
  [Ease.Linear]: [0, 0, 1, 1],
  [Ease.Overshoot]: [0.34, 1.56, 0.64, 1]
};

export const EASE_LABEL: Record<Ease, string> = {
  [Ease.Standard]: 'Standard',
  [Ease.Enter]: 'Ease out',
  [Ease.Exit]: 'Ease in',
  [Ease.Linear]: 'Linear',
  [Ease.Overshoot]: 'Overshoot'
};

export const DURATION = { quick: 8, base: 15, slow: 24 } as const;

const NEWTON_STEPS = 8;

function bezierAxis(a: number, b: number, t: number): number {
  const u = 1 - t;
  return 3 * u * u * t * a + 3 * u * t * t * b + t * t * t;
}

function bezierSlope(a: number, b: number, t: number): number {
  const u = 1 - t;
  return 3 * u * u * a + 6 * u * t * (b - a) + 3 * t * t * (1 - b);
}

export function ease(kind: Ease, progress: number): number {
  const x = Math.min(1, Math.max(0, progress));
  const [x1, y1, x2, y2] = BEZIERS[kind];
  let t = x;

  for (let i = 0; i < NEWTON_STEPS; i++) {
    const slope = bezierSlope(x1, x2, t);
    if (Math.abs(slope) < 1e-6) {
      break;
    }
    t -= (bezierAxis(x1, x2, t) - x) / slope;
    t = Math.min(1, Math.max(0, t));
  }

  return bezierAxis(y1, y2, t);
}

export function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

export enum TransitionKind {
  None = 'none',
  Fade = 'fade',
  SlideUp = 'slide-up',
  SlideDown = 'slide-down',
  SlideLeft = 'slide-left',
  SlideRight = 'slide-right',
  Scale = 'scale',
  Wipe = 'wipe',
  Blur = 'blur'
}

export const TRANSITION_KINDS = Object.values(TransitionKind) as [TransitionKind, ...TransitionKind[]];

export type TransitionLook = { opacity: number; transform: string; clipPath: string; filter: string };

const SLIDE_DISTANCE = 12;
const SCALE_FROM = 0.86;
const BLUR_PX = 24;

type Look = (hidden: number) => Partial<TransitionLook>;

const LOOKS: Record<TransitionKind, Look> = {
  [TransitionKind.None]: () => ({}),
  [TransitionKind.Fade]: (h) => ({ opacity: 1 - h }),
  [TransitionKind.SlideUp]: (h) => ({ opacity: 1 - h, transform: `translateY(${h * SLIDE_DISTANCE}%)` }),
  [TransitionKind.SlideDown]: (h) => ({ opacity: 1 - h, transform: `translateY(${-h * SLIDE_DISTANCE}%)` }),
  [TransitionKind.SlideLeft]: (h) => ({ opacity: 1 - h, transform: `translateX(${h * SLIDE_DISTANCE}%)` }),
  [TransitionKind.SlideRight]: (h) => ({ opacity: 1 - h, transform: `translateX(${-h * SLIDE_DISTANCE}%)` }),
  [TransitionKind.Scale]: (h) => ({ opacity: 1 - h, transform: `scale(${lerp(1, SCALE_FROM, h)})` }),
  [TransitionKind.Wipe]: (h) => ({ clipPath: `inset(0 ${h * 100}% 0 0)` }),
  [TransitionKind.Blur]: (h) => ({ opacity: 1 - h, filter: `blur(${h * BLUR_PX}px)` })
};

const VISIBLE: TransitionLook = { opacity: 1, transform: '', clipPath: '', filter: '' };

export function transitionLook(kind: TransitionKind, hidden: number): TransitionLook {
  return { ...VISIBLE, ...LOOKS[kind](Math.min(1, Math.max(0, hidden))) };
}

export type Edge = { kind: TransitionKind; durationInFrames: number };

export function clipLook(frame: number, length: number, enter: Edge, exit: Edge): TransitionLook {
  if (enter.durationInFrames > 0 && frame < enter.durationInFrames) {
    return transitionLook(enter.kind, 1 - ease(Ease.Enter, frame / enter.durationInFrames));
  }

  const exitStart = length - exit.durationInFrames;
  if (exit.durationInFrames > 0 && frame >= exitStart) {
    return transitionLook(exit.kind, ease(Ease.Exit, (frame - exitStart) / exit.durationInFrames));
  }

  return VISIBLE;
}
