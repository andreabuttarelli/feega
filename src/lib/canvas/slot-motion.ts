export enum SlotPhase {
  Enter = 'enter',
  Leave = 'leave'
}

export const SLOT_MOVE_MS = 220;
export const SLOT_FADE_MS = 120;
export const SLOT_STAGGER_MS = 20;
export const SLOT_MIN_SCALE = 0.85;

const FADE_SHARE = SLOT_FADE_MS / SLOT_MOVE_MS;

export type SlotMotion = { duration: number; delay: number };

export const slotTiming = (phase: SlotPhase, index: number, reduced: boolean): SlotMotion => {
  if (reduced) {
    return { duration: 0, delay: 0 };
  }

  return { duration: SLOT_MOVE_MS, delay: phase === SlotPhase.Enter ? index * SLOT_STAGGER_MS : 0 };
};

const clamp = (n: number) => Math.min(1, Math.max(0, n));

export const expoOut = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

export const slotFrame = (phase: SlotPhase, t: number, naturalPx: number) => {
  const visible = phase === SlotPhase.Enter ? clamp(t / FADE_SHARE) : clamp((t - (1 - FADE_SHARE)) / FADE_SHARE);
  const size = phase === SlotPhase.Enter ? expoOut(t) : 1 - expoOut(1 - t);

  return { opacity: visible, scale: SLOT_MIN_SCALE + (1 - SLOT_MIN_SCALE) * visible, widthPx: naturalPx * size };
};

export const prefersReducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const slotTransition = (node: HTMLElement, params: { phase: SlotPhase; index: number }) => {
  const naturalPx = node.getBoundingClientRect().width;
  const { duration, delay } = slotTiming(params.phase, params.index, prefersReducedMotion());

  return {
    duration,
    delay,
    easing: (t: number) => t,
    css: (t: number) => {
      const f = slotFrame(params.phase, t, naturalPx);

      return `opacity:${f.opacity};transform:scale(${f.scale});max-width:${f.widthPx}px;overflow:hidden;white-space:nowrap;`;
    }
  };
};
