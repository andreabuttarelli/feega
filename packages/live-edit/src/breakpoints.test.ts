import { describe, expect, it } from 'vitest';
import { ALL_SIZES, DEFAULT_BREAKPOINTS, Direction, activeAt, overriddenAt, readBreakpoints, targetOf } from './breakpoints';

const names = (b: { points: { name: string }[] }) => b.points.map((p) => p.name);

describe('readBreakpoints', () => {
  it('falls back to the Tailwind defaults', () => {
    expect(readBreakpoints({ tailwindConfig: null, sheets: [] })).toEqual(DEFAULT_BREAKPOINTS);
  });

  it('reads v4 theme breakpoints and keeps the defaults it does not override', () => {
    const sheet = '@import "tailwindcss";\n@theme {\n  --breakpoint-md: 50rem;\n  --breakpoint-3xl: 1920px;\n}';
    const out = readBreakpoints({ tailwindConfig: null, sheets: [sheet] });
    expect(out.points.find((p) => p.name === 'md')?.px).toBe(800);
    expect(names(out)).toEqual(['sm', 'md', 'lg', 'xl', '2xl', '3xl']);
  });

  it('drops the defaults when v4 resets them', () => {
    const sheet = '@theme {\n  --breakpoint-*: initial;\n  --breakpoint-tablet: 700px;\n  --breakpoint-desk: 1100px;\n}';
    expect(names(readBreakpoints({ tailwindConfig: null, sheets: [sheet] }))).toEqual(['tablet', 'desk']);
  });

  it('reads v3 screens that replace the defaults', () => {
    const config = "module.exports = { theme: { screens: { tablet: '640px', 'wide': '1280px' } } }";
    expect(readBreakpoints({ tailwindConfig: config, sheets: [] }).points).toEqual([
      { name: 'tablet', px: 640 },
      { name: 'wide', px: 1280 }
    ]);
  });

  it('merges v3 extend.screens into the defaults', () => {
    const config = "export default { theme: { extend: { screens: { '3xl': '1792px' } } } }";
    expect(names(readBreakpoints({ tailwindConfig: config, sheets: [] }))).toEqual(['sm', 'md', 'lg', 'xl', '2xl', '3xl']);
  });

  it('reads media queries from plain css, mobile-first', () => {
    const sheet = '@media (min-width: 600px) { .a { x: 1 } }\n@media (min-width: 900px) { .a { x: 1 } }\n@media (max-width: 400px) { .a { x: 1 } }';
    const out = readBreakpoints({ tailwindConfig: null, sheets: [sheet] });
    expect(out.direction).toBe(Direction.MobileFirst);
    expect(out.points).toEqual([
      { name: '400px', px: 400 },
      { name: '600px', px: 600 },
      { name: '900px', px: 900 }
    ]);
  });

  it('detects desktop-first when max-width dominates', () => {
    const sheet = '@media (max-width: 1024px) {}\n@media (max-width: 768px) {}\n@media (min-width: 1400px) {}';
    expect(readBreakpoints({ tailwindConfig: null, sheets: [sheet] }).direction).toBe(Direction.DesktopFirst);
  });

  it('keeps the named defaults of a Tailwind v4 project that only has its own media queries', () => {
    const sheet = '@import "tailwindcss";\n@media (max-width: 720px) {}';
    expect(readBreakpoints({ tailwindConfig: null, sheets: [sheet] })).toEqual(DEFAULT_BREAKPOINTS);
  });

  it('keeps the named defaults of a Tailwind v3 project without screens', () => {
    expect(readBreakpoints({ tailwindConfig: 'module.exports = {}', sheets: ['@media (max-width: 720px) {}'] })).toEqual(DEFAULT_BREAKPOINTS);
  });

  it('ignores media queries when tailwind breakpoints exist', () => {
    const sheet = '@theme { --breakpoint-md: 48rem; }\n@media (max-width: 500px) {}';
    expect(readBreakpoints({ tailwindConfig: null, sheets: [sheet] }).direction).toBe(Direction.MobileFirst);
  });
});

describe('activeAt', () => {
  it('is the largest breakpoint at or below the width, mobile-first', () => {
    expect(activeAt(DEFAULT_BREAKPOINTS, 800)?.name).toBe('md');
    expect(activeAt(DEFAULT_BREAKPOINTS, 768)?.name).toBe('md');
    expect(activeAt(DEFAULT_BREAKPOINTS, 2000)?.name).toBe('2xl');
  });

  it('is null below the smallest breakpoint', () => {
    expect(activeAt(DEFAULT_BREAKPOINTS, 375)).toBeNull();
  });

  it('is the smallest breakpoint at or above the width, desktop-first', () => {
    const desk = { direction: Direction.DesktopFirst, points: [{ name: '768px', px: 768 }, { name: '1024px', px: 1024 }] };
    expect(activeAt(desk, 700)?.name).toBe('768px');
    expect(activeAt(desk, 900)?.name).toBe('1024px');
    expect(activeAt(desk, 1400)).toBeNull();
  });
});

describe('targetOf', () => {
  it('writes the base for all sizes', () => {
    expect(targetOf(DEFAULT_BREAKPOINTS, ALL_SIZES)).toEqual({ variant: '', media: null });
  });

  it('prefixes a Tailwind class and builds a min-width query, mobile-first', () => {
    expect(targetOf(DEFAULT_BREAKPOINTS, 'md')).toEqual({ variant: 'md', media: '(min-width: 768px)' });
  });

  it('uses max-width, desktop-first', () => {
    const desk = { direction: Direction.DesktopFirst, points: [{ name: 'md', px: 768 }] };
    expect(targetOf(desk, 'md')).toEqual({ variant: 'max-md', media: '(max-width: 768px)' });
  });

  it('writes an arbitrary width as a bracketed variant, desktop-first', () => {
    const desk = { direction: Direction.DesktopFirst, points: [{ name: '720px', px: 720 }] };
    expect(targetOf(desk, '720px')).toEqual({ variant: 'max-[720px]', media: '(max-width: 720px)' });
  });

  it('writes an arbitrary width as a bracketed variant, mobile-first', () => {
    const up = { direction: Direction.MobileFirst, points: [{ name: '720px', px: 720 }] };
    expect(targetOf(up, '720px')).toEqual({ variant: 'min-[720px]', media: '(min-width: 720px)' });
  });

  it('refuses an unknown breakpoint', () => {
    expect(targetOf(DEFAULT_BREAKPOINTS, 'huge')).toBeNull();
  });
});

describe('overriddenAt', () => {
  const owns = (utility: string) => utility.startsWith('p-');

  it('finds a bracketed arbitrary width', () => {
    const up = { direction: Direction.MobileFirst, points: [{ name: '720px', px: 720 }] };
    expect(overriddenAt(up, 'p-2 min-[720px]:p-4', owns)).toEqual(['720px']);
  });

  it('lists the breakpoints that override the property', () => {
    expect(overriddenAt(DEFAULT_BREAKPOINTS, 'p-2 md:p-4 lg:p-8 md:flex', owns)).toEqual(['md', 'lg']);
  });

  it('ignores the base value and other properties', () => {
    expect(overriddenAt(DEFAULT_BREAKPOINTS, 'p-2 md:flex', owns)).toEqual([]);
  });

  it('reads max- variants', () => {
    const desk = { direction: Direction.DesktopFirst, points: [{ name: 'md', px: 768 }] };
    expect(overriddenAt(desk, 'max-md:p-4', owns)).toEqual(['md']);
  });
});
