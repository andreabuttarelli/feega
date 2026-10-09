import { Ease } from './design';
import type { EaseSpec } from './keyframes';

export enum MotionStyle {
  LaunchFilm = 'launch-film',
  AppleMinimal = 'apple-minimal',
  UiMorph = 'ui-morph'
}

export const MOTION_STYLES = Object.values(MotionStyle) as [MotionStyle, ...MotionStyle[]];
export const DEFAULT_STYLE = MotionStyle.LaunchFilm;

export type StyleEases = { enter: EaseSpec; move: EaseSpec };

const HOUSE_EASES: StyleEases = { enter: Ease.Enter, move: Ease.Standard };

export const STYLE_EASES: Record<MotionStyle, StyleEases> = {
  [MotionStyle.LaunchFilm]: HOUSE_EASES,
  [MotionStyle.AppleMinimal]: HOUSE_EASES,
  [MotionStyle.UiMorph]: HOUSE_EASES
};
