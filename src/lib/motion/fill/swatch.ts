import { FillType, type Fill, type FillOf, type Stop } from '@feega/motion-core/motion/fill/model';

const PERCENT = 100;
const NO_PICTURE = 'var(--ui-input)';

export type SwatchPaints = { color: (value: string) => string; picture: (fill: FillOf<FillType.Image>) => string | undefined };

const pct = (n: number) => Math.round(n * PERCENT);
export const stopCss = (stops: Stop[], color: SwatchPaints['color']) => [...stops].sort((a, b) => a.pos - b.pos).map((s) => `${color(s.color)} ${pct(s.pos)}%`).join(',');

const SWATCH: { [T in FillType]: (f: FillOf<T>, paints: SwatchPaints) => string } = {
  [FillType.Solid]: (f, { color }) => color(f.color),
  [FillType.Linear]: (f, { color }) => `linear-gradient(${f.angle + 90}deg,${stopCss(f.stops, color)})`,
  [FillType.Radial]: (f, { color }) => `radial-gradient(circle,${stopCss(f.stops, color)})`,
  [FillType.Angular]: (f, { color }) => `conic-gradient(from ${f.angle}deg,${stopCss(f.stops, color)})`,
  [FillType.Diamond]: (f, { color }) => `radial-gradient(closest-side,${stopCss(f.stops, color)})`,
  [FillType.Image]: (f, { picture }) => {
    const preview = picture(f);
    return preview ? `center / cover no-repeat url("${preview}")` : NO_PICTURE;
  }
};

export const swatchOf = (fill: Fill, paints: SwatchPaints): string => (SWATCH[fill.type] as (f: Fill, p: SwatchPaints) => string)(fill, paints);
