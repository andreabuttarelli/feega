type TextLook = { font?: string; weight?: number; size?: number; leading?: number };

export const pxOf = (fraction: number, unit: number) => Math.round(fraction * unit);

export const fractionOf = (px: number, unit: number) => px / unit;

export const textFace = (look: TextLook) => [look.font, look.weight].filter((v) => v !== undefined).join(' ');

export function textMetrics(look: TextLook, unit: number): string {
  const size = look.size === undefined ? '' : `${pxOf(look.size, unit)} px`;
  return [size, look.leading === undefined ? '' : `${look.leading}`].filter(Boolean).join(' / ');
}
