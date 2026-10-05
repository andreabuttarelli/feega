import { z } from 'zod';
import { Ease, FASTEST_RATE } from './design';

export enum JunctionKind {
  Crossfade = 'crossfade',
  DipToBlack = 'dip-to-black',
  PushLeft = 'push-left',
  PushRight = 'push-right',
  Wipe = 'wipe',
  Zoom = 'zoom',
  Blur = 'blur'
}

export const JUNCTION_KINDS = Object.values(JunctionKind) as [JunctionKind, ...JunctionKind[]];

export enum Span {
  Whole = 'whole',
  FirstHalf = 'first-half',
  SecondHalf = 'second-half'
}

export type JunctionVars = Record<string, string | number>;
export type Move = { from: JunctionVars; to: JunctionVars; span: Span };
export type JunctionSpec = { label: string; ease: Ease; outgoing: Move[]; incoming: Move[]; incomingBelow?: Move[] };

export const MAX_JUNCTION_FRAMES = FASTEST_RATE * 2;

export const junctionSchema = z.object({
  kind: z.enum(JUNCTION_KINDS),
  durationInFrames: z.number().int().min(2).max(MAX_JUNCTION_FRAMES)
});

export type Junction = z.infer<typeof junctionSchema>;

const whole = (from: JunctionVars, to: JunctionVars): Move => ({ from, to, span: Span.Whole });
const held = (vars: JunctionVars, span: Span): Move => ({ from: vars, to: vars, span });

export const JUNCTION: Record<JunctionKind, JunctionSpec> = {
  [JunctionKind.Crossfade]: { label: 'Cross dissolve', ease: Ease.Linear, outgoing: [], incoming: [whole({ opacity: 0 }, { opacity: 1 })], incomingBelow: [whole({ opacity: 1 }, { opacity: 0 })] },
  [JunctionKind.DipToBlack]: {
    label: 'Dip to black',
    ease: Ease.Standard,
    outgoing: [{ from: { filter: 'brightness(1)' }, to: { filter: 'brightness(0)' }, span: Span.FirstHalf }, held({ opacity: 0 }, Span.SecondHalf)],
    incoming: [held({ opacity: 0, filter: 'brightness(0)' }, Span.FirstHalf), { from: { opacity: 1, filter: 'brightness(0)' }, to: { opacity: 1, filter: 'brightness(1)' }, span: Span.SecondHalf }]
  },
  [JunctionKind.PushLeft]: { label: 'Push left', ease: Ease.Standard, outgoing: [whole({ xPercent: 0 }, { xPercent: -100 })], incoming: [whole({ xPercent: 100 }, { xPercent: 0 })] },
  [JunctionKind.PushRight]: { label: 'Push right', ease: Ease.Standard, outgoing: [whole({ xPercent: 0 }, { xPercent: 100 })], incoming: [whole({ xPercent: -100 }, { xPercent: 0 })] },
  [JunctionKind.Wipe]: {
    label: 'Wipe',
    ease: Ease.Standard,
    outgoing: [],
    incoming: [whole({ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' })],
    incomingBelow: [whole({ clipPath: 'inset(0 0 0 0%)' }, { clipPath: 'inset(0 0 0 100%)' })]
  },
  [JunctionKind.Zoom]: { label: 'Zoom through', ease: Ease.Standard, outgoing: [whole({ scale: 1, opacity: 1 }, { scale: 1.6, opacity: 0 })], incoming: [whole({ scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1 })] },
  [JunctionKind.Blur]: {
    label: 'Blur dissolve',
    ease: Ease.Standard,
    outgoing: [whole({ filter: 'blur(0px)', opacity: 1 }, { filter: 'blur(32px)', opacity: 0 })],
    incoming: [whole({ filter: 'blur(32px)', opacity: 0 }, { filter: 'blur(0px)', opacity: 1 })]
  }
};
