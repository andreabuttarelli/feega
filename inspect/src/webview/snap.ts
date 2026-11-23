import type { Scales, Step } from '@feega/live-edit/theme-scales';

export enum ScaleKind {
  Spacing = 'spacing',
  Radius = 'radius',
  FontSize = 'fontSize'
}

export enum Snap {
  On = 'on',
  Off = 'off'
}

export enum Origin {
  Drag = 'drag',
  Typed = 'typed'
}

export const SNAP_PX = 2;
export const SNAP_RATIO = 0.08;
const ON_STEP_PX = 0.5;

const SIDES = ['all', 'x', 'y', 'top', 'right', 'bottom', 'left'];
const CORNERS = ['tl', 'tr', 'br', 'bl'];

export const SNAPPABLE: Record<string, ScaleKind> = {
  ...Object.fromEntries(['padding', 'margin'].flatMap((group) => SIDES.map((side) => [`${group}-${side}`, ScaleKind.Spacing]))),
  gap: ScaleKind.Spacing,
  'row-gap': ScaleKind.Spacing,
  'column-gap': ScaleKind.Spacing,
  width: ScaleKind.Spacing,
  height: ScaleKind.Spacing,
  radius: ScaleKind.Radius,
  ...Object.fromEntries(CORNERS.map((corner) => [`radius-${corner}`, ScaleKind.Radius])),
  'font-size': ScaleKind.FontSize
};

export function scaleFor(row: string, scales: Scales | null): Step[] | null {
  const kind = SNAPPABLE[row];
  return kind && scales ? scales[kind] : null;
}

const reach = (px: number) => Math.max(SNAP_PX, Math.abs(px) * SNAP_RATIO);

function nearest(px: number, steps: Step[]): Step | null {
  return steps.reduce<Step | null>((best, step) => (best === null || Math.abs(step.px - px) < Math.abs(best.px - px) ? step : best), null);
}

export function snap(px: number, steps: Step[], mode: Snap): { px: number; step: Step | null } {
  const found = mode === Snap.On ? nearest(px, steps) : null;
  return found && Math.abs(found.px - px) <= reach(px) ? { px: found.px, step: found } : { px, step: null };
}

const SNAPS_FROM: Record<Origin, boolean> = { [Origin.Drag]: true, [Origin.Typed]: false };

export const settled = (px: number, steps: Step[], origin: Origin, mode: Snap): number => (SNAPS_FROM[origin] ? snap(px, steps, mode).px : px);

export function check(px: number, steps: Step[]): { on: boolean; nearest: Step | null } {
  const found = nearest(px, steps);
  return { on: found === null || Math.abs(found.px - px) <= ON_STEP_PX, nearest: found };
}

export const ticksAround = (px: number, steps: Step[], halfWindow: number): number[] =>
  steps.map((step) => step.px - px).filter((offset) => Math.abs(offset) <= halfWindow);
