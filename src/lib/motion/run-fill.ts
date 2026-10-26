import { FillType, newFill, retypeFill, setFill, type FillPatch } from '@feega/motion-core/motion/fill/model';
import { MIXED, type GradientFill, type RunStyle } from '@feega/motion-core/motion/text-runs';

export enum RunPaint {
  Solid = 'solid',
  Gradient = 'gradient',
  Mixed = 'mixed'
}

export const GRADIENT_TYPES = [FillType.Linear, FillType.Radial, FillType.Angular, FillType.Diamond] as const;

type Shown = { fill: RunStyle['fill'] | typeof MIXED; color: RunStyle['color'] | typeof MIXED };

export function paintOf(shown: Shown): RunPaint {
  if (shown.fill === MIXED || shown.color === MIXED) {
    return RunPaint.Mixed;
  }
  return shown.fill ? RunPaint.Gradient : RunPaint.Solid;
}

export function asGradient(current: GradientFill | undefined, type: (typeof GRADIENT_TYPES)[number], colour: string): GradientFill {
  return (current ? retypeFill([current], 0, type)[0] : newFill(type, colour)) as GradientFill;
}

export const gradientPatched = (fill: GradientFill, patch: FillPatch): GradientFill => setFill([fill], 0, patch)[0] as GradientFill;
