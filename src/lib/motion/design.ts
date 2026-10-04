export const FPS = 30;
export const FRAME_RATES = [24, 25, 30, 50, 60] as const;
export type FrameRate = (typeof FRAME_RATES)[number];
export const FASTEST_RATE = Math.max(...FRAME_RATES);
export const MAX_SECONDS = 60;

export const maxFrames = (fps: number) => MAX_SECONDS * fps;

export enum Ease {
  Standard = 'standard',
  Enter = 'enter',
  Exit = 'exit',
  Linear = 'linear',
  Overshoot = 'overshoot'
}

export const EASE_IDS = [Ease.Standard, Ease.Enter, Ease.Exit, Ease.Linear, Ease.Overshoot] as const;

export const EASE_LABEL: Record<Ease, string> = {
  [Ease.Standard]: 'Standard',
  [Ease.Enter]: 'Ease out',
  [Ease.Exit]: 'Ease in',
  [Ease.Linear]: 'Linear',
  [Ease.Overshoot]: 'Overshoot'
};

export const DURATION = { quick: 8, base: 15, slow: 24 } as const;

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

export type Edge = { kind: TransitionKind; durationInFrames: number };
