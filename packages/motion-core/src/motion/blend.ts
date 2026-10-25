export enum BlendMode {
  Normal = 'normal',
  Multiply = 'multiply',
  Screen = 'screen',
  Overlay = 'overlay',
  Darken = 'darken',
  Lighten = 'lighten',
  ColorDodge = 'color-dodge',
  ColorBurn = 'color-burn',
  HardLight = 'hard-light',
  SoftLight = 'soft-light',
  Difference = 'difference',
  Exclusion = 'exclusion',
  Hue = 'hue',
  Saturation = 'saturation',
  Color = 'color',
  Luminosity = 'luminosity'
}

export const BLEND_MODES = Object.values(BlendMode) as [BlendMode, ...BlendMode[]];

export const blendLabel = (mode: BlendMode): string => mode.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

export function blendStyle(mode: BlendMode): string | undefined {
  return mode === BlendMode.Normal ? undefined : mode;
}
