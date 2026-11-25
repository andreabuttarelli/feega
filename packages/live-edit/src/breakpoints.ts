import { utilityOf, variantOf } from './live-fields';

export enum Direction {
  MobileFirst = 'mobile-first',
  DesktopFirst = 'desktop-first'
}

export type Breakpoint = { name: string; px: number };

export type Breakpoints = { direction: Direction; points: Breakpoint[] };

export type ProjectCss = { tailwindConfig: string | null; sheets: string[] };

export type Target = { variant: string; media: string | null };

export const ALL_SIZES = 'all';

const PX_PER_REM = 16;
const MAX_PREFIX = 'max-';
const MIN_PREFIX = 'min-';
const RESET_ALL = '*';

export const DEFAULT_BREAKPOINTS: Breakpoints = {
  direction: Direction.MobileFirst,
  points: [
    { name: 'sm', px: 640 },
    { name: 'md', px: 768 },
    { name: 'lg', px: 1024 },
    { name: 'xl', px: 1280 },
    { name: '2xl', px: 1536 }
  ]
};

const LENGTH = /^([\d.]+)(px|rem|em)$/;
const THEME_VAR = /--breakpoint-([\w*-]+)\s*:\s*([^;}]+)[;}]/g;
const SCREENS = /screens\s*:\s*\{([^}]*)\}/;
const SCREEN_PAIR = /(?:['"]([^'"]+)['"]|(\w+))\s*:\s*['"]([^'"]+)['"]/g;
const EXTEND = /extend\s*:\s*\{/g;
const TAILWIND_SHEET = /@import\s+(?:url\()?['"]tailwindcss|@tailwind\b|@theme\b/;
const PIXEL_NAME = /^[\d.]+px$/;
const ARBITRARY = /^(?:min|max)-\[([^\]]+)\]$/;
const MEDIA_WIDTH = /@media[^{]*\(\s*(min|max)-width\s*:\s*([\d.]+)(px|em|rem)/g;

function pxOf(text: string): number | null {
  const m = text.trim().match(LENGTH);
  if (!m) {
    return null;
  }
  return m[2] === 'px' ? Number(m[1]) : Number(m[1]) * PX_PER_REM;
}

const ascending = (points: Breakpoint[]) => [...points].sort((a, b) => a.px - b.px);

const merged = (base: Breakpoint[], more: Breakpoint[]): Breakpoint[] => {
  const byName = new Map(base.map((p) => [p.name, p]));
  more.forEach((p) => byName.set(p.name, p));
  return ascending([...byName.values()]);
};

function themeBreakpoints(sheets: string[]): Breakpoints | null {
  const found: Breakpoint[] = [];
  let reset = false;
  for (const m of sheets.flatMap((s) => [...s.matchAll(THEME_VAR)])) {
    if (m[1] === RESET_ALL) {
      reset = m[2].trim() === 'initial';
      continue;
    }
    const px = pxOf(m[2]);
    if (px !== null) {
      found.push({ name: m[1], px });
    }
  }
  if (!found.length && !reset) {
    return null;
  }
  const base = reset ? [] : DEFAULT_BREAKPOINTS.points;
  return { direction: Direction.MobileFirst, points: merged(base, found) };
}

function insideExtend(text: string, index: number): boolean {
  const opens = [...text.slice(0, index).matchAll(EXTEND)];
  const last = opens.at(-1);
  if (!last) {
    return false;
  }
  const from = last.index! + last[0].length;
  const depth = [...text.slice(from, index)].reduce((d, ch) => d + (ch === '{' ? 1 : ch === '}' ? -1 : 0), 1);
  return depth > 0;
}

function configBreakpoints(config: string | null): Breakpoints | null {
  const found = config?.match(SCREENS);
  if (!config || !found) {
    return null;
  }
  const screens = [...found[1].matchAll(SCREEN_PAIR)].flatMap((m) => {
    const px = pxOf(m[3]);
    return px === null ? [] : [{ name: m[1] ?? m[2], px }];
  });
  const base = insideExtend(config, found.index!) ? DEFAULT_BREAKPOINTS.points : [];
  return { direction: Direction.MobileFirst, points: merged(base, screens) };
}

function mediaBreakpoints(sheets: string[]): Breakpoints | null {
  const queries = sheets.flatMap((s) => [...s.matchAll(MEDIA_WIDTH)]);
  const widths = new Map<number, string>();
  let max = 0;
  let min = 0;
  for (const m of queries) {
    const px = pxOf(`${m[2]}${m[3]}`);
    if (px === null) {
      continue;
    }
    widths.set(px, `${px}px`);
    max += m[1] === 'max' ? 1 : 0;
    min += m[1] === 'min' ? 1 : 0;
  }
  if (!widths.size) {
    return null;
  }
  const points = ascending([...widths].map(([px, name]) => ({ name, px })));
  return { direction: max > min ? Direction.DesktopFirst : Direction.MobileFirst, points };
}

const usesTailwind = (project: ProjectCss) => project.tailwindConfig !== null || project.sheets.some((s) => TAILWIND_SHEET.test(s));

export function readBreakpoints(project: ProjectCss): Breakpoints {
  const named = themeBreakpoints(project.sheets) ?? configBreakpoints(project.tailwindConfig);
  if (named || usesTailwind(project)) {
    return named ?? DEFAULT_BREAKPOINTS;
  }
  return mediaBreakpoints(project.sheets) ?? DEFAULT_BREAKPOINTS;
}

export function activeAt(set: Breakpoints, width: number): Breakpoint | null {
  if (set.direction === Direction.DesktopFirst) {
    return set.points.find((p) => width <= p.px) ?? null;
  }
  return [...set.points].reverse().find((p) => width >= p.px) ?? null;
}

export function targetOf(set: Breakpoints, name: string): Target | null {
  if (name === ALL_SIZES) {
    return { variant: '', media: null };
  }
  const point = set.points.find((p) => p.name === name);
  if (!point) {
    return null;
  }
  const label = PIXEL_NAME.test(name) ? `[${name}]` : name;
  if (set.direction === Direction.DesktopFirst) {
    return { variant: `${MAX_PREFIX}${label}`, media: `(max-width: ${point.px}px)` };
  }
  return { variant: PIXEL_NAME.test(name) ? `${MIN_PREFIX}${label}` : name, media: `(min-width: ${point.px}px)` };
}

const breakpointName = (variant: string) => variant.replace(ARBITRARY, '$1').replace(new RegExp(`^${MAX_PREFIX}`), '');

export function overriddenAt(set: Breakpoints, classes: string, owns: (utility: string) => boolean): string[] {
  const names = new Set(
    classes
      .split(/\s+/)
      .filter((token) => token && owns(utilityOf(token)))
      .map((token) => breakpointName(variantOf(token)))
  );
  return set.points.filter((p) => names.has(p.name)).map((p) => p.name);
}
