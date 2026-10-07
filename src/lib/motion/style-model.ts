import type { Bezier } from './keyframes';

export enum MotionStyle {
  AppleMinimal = 'apple-minimal'
}

export const MOTION_STYLES = Object.values(MotionStyle) as [MotionStyle, ...MotionStyle[]];
export const DEFAULT_STYLE = MotionStyle.AppleMinimal;

export type StyleEases = { enter: Bezier; move: Bezier };

export const STYLE_EASES: Record<MotionStyle, StyleEases> = {
  [MotionStyle.AppleMinimal]: { enter: [0.22, 1, 0.36, 1], move: [0.65, 0, 0.35, 1] }
};
