import { parseSheets, readSheets } from './css-tokens';
import { colourOf } from './token-colour';
import type { ReadFile } from './files';
import { LiveProp, type StyleProp } from './live-fields';

export type LiveTheme = { colours: Map<string, string>; radii: Map<number, string>; sizes: Map<number, string>; spacingPx: number };

const DEFAULT_SPACING_REM = 0.25;
export const DEFAULT_REM_PX = 16;
const FULL_RADIUS_PX = 9999;

const DEFAULT_SIZES_REM: [number, string][] = [
  [0.75, 'xs'], [0.875, 'sm'], [1, 'base'], [1.125, 'lg'], [1.25, 'xl'], [1.5, '2xl'], [1.875, '3xl'], [2.25, '4xl'], [3, '5xl'], [3.75, '6xl'], [4.5, '7xl'], [6, '8xl'], [8, '9xl']
];

const DEFAULT_RADII_REM: [number, string][] = [
  [0, 'none'], [0.125, 'xs'], [0.25, 'sm'], [0.375, 'md'], [0.5, 'lg'], [0.75, 'xl'], [1, '2xl'], [1.5, '3xl'], [2, '4xl']
];

const WEIGHTS: Record<string, string> = {
  '100': 'thin', '200': 'extralight', '300': 'light', '400': 'normal', '500': 'medium', '600': 'semibold', '700': 'bold', '800': 'extrabold', '900': 'black'
};

const pxOf = (raw: string, remPx = DEFAULT_REM_PX): number | null => {
  const m = raw.trim().match(/^(-?[\d.]+)(px|rem)?$/);
  return m ? Number(m[1]) * (m[2] === 'rem' ? remPx : 1) : null;
};

const named = (declared: { name: string; raw: string }[], prefix: string, remPx: number) =>
  declared.flatMap((d) => {
    const px = d.name.startsWith(prefix) ? pxOf(d.raw, remPx) : null;
    return px === null ? [] : [[px, d.name.slice(prefix.length)] as [number, string]];
  });

const scaleOf = (inRem: [number, string][], inPx: [number, string][], remPx: number) =>
  new Map([...inRem.map(([rem, name]) => [rem * remPx, name] as [number, string]), ...inPx].map(([px, name]) => [Math.round(px), name]));

export async function liveTheme(read: ReadFile, remPx = DEFAULT_REM_PX): Promise<LiveTheme> {
  const { declared } = parseSheets(await readSheets(read));
  const colours = new Map(declared.flatMap((d) => {
    const hex = d.name.startsWith('--color-') ? colourOf(d.raw) : null;
    return hex ? [[hex, d.name.slice('--color-'.length)] as [string, string]] : [];
  }));
  return {
    colours,
    radii: scaleOf(DEFAULT_RADII_REM, named(declared, '--radius-', remPx), remPx),
    sizes: scaleOf(DEFAULT_SIZES_REM, named(declared, '--text-', remPx), remPx),
    spacingPx: pxOf(declared.find((d) => d.name === '--spacing')?.raw ?? '', remPx) ?? DEFAULT_SPACING_REM * remPx
  };
}

const arbitrary = (value: string) => `[${value.replace(/\s+/g, '_')}]`;

const pxToken = (raw: string) => {
  const px = pxOf(raw);
  return px === null ? arbitrary(raw) : arbitrary(`${px}px`);
};

function colourToken(raw: string, theme: LiveTheme): string {
  const hex = colourOf(raw);
  return hex ? (theme.colours.get(hex) ?? arbitrary(hex)) : arbitrary(raw);
}

function spaceToken(raw: string, theme: LiveTheme): string {
  const px = pxOf(raw);
  if (px === null) {
    return arbitrary(raw);
  }
  const steps = px / theme.spacingPx;
  return Number.isInteger(steps) ? String(steps) : pxToken(raw);
}

function scaleToken(raw: string, scale: Map<number, string>): string {
  const px = pxOf(raw);
  return px === null ? arbitrary(raw) : (scale.get(Math.round(px)) ?? pxToken(raw));
}

const TOKEN_OF: Record<StyleProp, (raw: string, theme: LiveTheme) => string> = {
  [LiveProp.Color]: colourToken,
  [LiveProp.Fill]: colourToken,
  [LiveProp.FontSize]: (raw, theme) => scaleToken(raw, theme.sizes),
  [LiveProp.FontWeight]: (raw) => WEIGHTS[raw.trim()] ?? arbitrary(raw),
  [LiveProp.Padding]: spaceToken,
  [LiveProp.Margin]: spaceToken,
  [LiveProp.Gap]: spaceToken,
  [LiveProp.Radius]: (raw, theme) => (pxOf(raw) !== null && pxOf(raw)! >= FULL_RADIUS_PX ? 'full' : scaleToken(raw, theme.radii))
};

export const tokenFor = (prop: StyleProp, raw: string, theme: LiveTheme) => TOKEN_OF[prop](raw, theme);
