export enum MotionStyle {
  AppleMinimal = 'apple-minimal'
}

export const MOTION_STYLES = Object.values(MotionStyle) as [MotionStyle, ...MotionStyle[]];
export const DEFAULT_STYLE = MotionStyle.AppleMinimal;
