type TextLook = { font?: string; weight?: number; size?: number; leading?: number };

export const pxOf = (fraction: number, unit: number) => Math.round(fraction * unit);

export const fractionOf = (px: number, unit: number) => px / unit;

export function textMeta(look: TextLook, unit: number): string {
  const face = [look.font, look.weight].filter((v) => v !== undefined).join(' ');
  const size = look.size === undefined ? '' : `${pxOf(look.size, unit)} px`;
  const metrics = [size, look.leading === undefined ? '' : `${look.leading}`].filter(Boolean).join(' / ');
  return [face, metrics].filter(Boolean).join(' · ');
}
