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
  Luminosity = 'luminosity',
  LinearBurn = 'linear-burn',
  LinearDodge = 'linear-dodge',
  VividLight = 'vivid-light',
  LinearLight = 'linear-light',
  PinLight = 'pin-light',
  HardMix = 'hard-mix',
  Subtract = 'subtract',
  Divide = 'divide',
  DarkerColor = 'darker-color',
  LighterColor = 'lighter-color'
}

const SHADER_ONLY: ReadonlySet<BlendMode> = new Set([
  BlendMode.LinearBurn,
  BlendMode.LinearDodge,
  BlendMode.VividLight,
  BlendMode.LinearLight,
  BlendMode.PinLight,
  BlendMode.HardMix,
  BlendMode.Subtract,
  BlendMode.Divide,
  BlendMode.DarkerColor,
  BlendMode.LighterColor
]);

export const BLEND_MODES = Object.values(BlendMode) as [BlendMode, ...BlendMode[]];

export const blendLabel = (mode: BlendMode): string => mode.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');

export function blendStyle(mode: BlendMode): string | undefined {
  return mode === BlendMode.Normal || SHADER_ONLY.has(mode) ? undefined : mode;
}
