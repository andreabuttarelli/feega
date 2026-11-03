import { FillType, colourAlpha, type Fill, type FillOf, type Stop } from '@feega/motion-core/motion/fill/model';

const PERCENT = 100;
const NO_PICTURE = 'var(--ui-input)';
const CHECKER = 'repeating-conic-gradient(#d4d4d4 0% 25%, #ffffff 0% 50%) 50% / 8px 8px';
const NO_PAINT = 'None';
const TRANSPARENT = 'transparent';
const HASH = /^#/;

export type SwatchPaints = { color: (value: string) => string; picture: (fill: FillOf<FillType.Image>) => string | undefined };

const pct = (n: number) => Math.round(n * PERCENT);
export const stopCss = (stops: Stop[], color: SwatchPaints['color']) => [...stops].sort((a, b) => a.pos - b.pos).map((s) => `${color(s.color)} ${pct(s.pos)}%`).join(',');

const SWATCH: { [T in FillType]: (f: FillOf<T>, paints: SwatchPaints) => string } = {
  [FillType.Solid]: (f, { color }) => `linear-gradient(${color(f.color)},${color(f.color)}), ${CHECKER}`,
  [FillType.Linear]: (f, { color }) => `linear-gradient(${f.angle + 90}deg,${stopCss(f.stops, color)}), ${CHECKER}`,
  [FillType.Radial]: (f, { color }) => `radial-gradient(circle,${stopCss(f.stops, color)}), ${CHECKER}`,
  [FillType.Angular]: (f, { color }) => `conic-gradient(from ${f.angle}deg,${stopCss(f.stops, color)}), ${CHECKER}`,
  [FillType.Diamond]: (f, { color }) => `radial-gradient(closest-side,${stopCss(f.stops, color)}), ${CHECKER}`,
  [FillType.Image]: (f, { picture }) => {
    const preview = picture(f);
    return preview ? `center / cover no-repeat url("${preview}")` : NO_PICTURE;
  }
};

export const swatchOf = (fill: Fill, paints: SwatchPaints): string => (SWATCH[fill.type] as (f: Fill, p: SwatchPaints) => string)(fill, paints);

export function solidName(colour: string): string {
  const { base, alpha } = colourAlpha(colour);
  return alpha === 0 || base.toLowerCase() === TRANSPARENT ? NO_PAINT : base.replace(HASH, '').toUpperCase();
}
