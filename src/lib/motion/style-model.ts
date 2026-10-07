import type { Bezier } from './keyframes';

export enum MotionStyle {
  LaunchFilm = 'launch-film',
  AppleMinimal = 'apple-minimal',
  UiMorph = 'ui-morph'
}

export const MOTION_STYLES = Object.values(MotionStyle) as [MotionStyle, ...MotionStyle[]];
export const DEFAULT_STYLE = MotionStyle.LaunchFilm;

export type StyleEases = { enter: Bezier; move: Bezier };

export const STYLE_EASES: Record<MotionStyle, StyleEases> = {
  [MotionStyle.LaunchFilm]: { enter: [0.16, 1, 0.3, 1], move: [0.83, 0, 0.17, 1] },
  [MotionStyle.AppleMinimal]: { enter: [0.16, 1, 0.3, 1], move: [0.65, 0, 0.35, 1] },
  [MotionStyle.UiMorph]: { enter: [0.16, 1, 0.3, 1], move: [0.65, 0, 0.35, 1] }
};
