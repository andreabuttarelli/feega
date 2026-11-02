import type { Padding } from '@feega/motion-core/motion/layout/model';

export enum PaddingView {
  Axes = 'axes',
  Sides = 'sides'
}

export type PaddingAxis = 'horizontal' | 'vertical';

export const AXIS_SIDES: Record<PaddingAxis, readonly [keyof Padding, keyof Padding]> = { horizontal: ['left', 'right'], vertical: ['top', 'bottom'] };

export const SIDE_ORDER: readonly (keyof Padding)[] = ['left', 'top', 'right', 'bottom'];

const AXES = Object.keys(AXIS_SIDES) as PaddingAxis[];

const paired = (padding: Padding) => AXES.every((axis) => padding[AXIS_SIDES[axis][0]] === padding[AXIS_SIDES[axis][1]]);

export const paddingView = (padding: Padding, split: boolean): PaddingView => (split || !paired(padding) ? PaddingView.Sides : PaddingView.Axes);

export const axisPatch = (padding: Padding, axis: PaddingAxis, value: number): Padding => ({ ...padding, [AXIS_SIDES[axis][0]]: value, [AXIS_SIDES[axis][1]]: value });

const collapsed = (padding: Padding): Padding => AXES.reduce((next, axis) => axisPatch(next, axis, padding[AXIS_SIDES[axis][0]]), padding);

export function togglePadding(padding: Padding, view: PaddingView): { split: boolean; padding: Padding | null } {
  if (view === PaddingView.Axes) {
    return { split: true, padding: null };
  }
  return { split: false, padding: paired(padding) ? null : collapsed(padding) };
}
