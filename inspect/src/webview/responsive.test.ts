import { describe, expect, it } from 'vitest';
import { ALL_SIZES, DEFAULT_BREAKPOINTS, Direction } from '@feega/live-edit/breakpoints';
import { FOLLOW, badgeText, overrideTitle, reachItems, rowOverrides, writeTarget } from './responsive';
import { ROWS } from './controls';

const FIXED = true;
const FULL = false;

describe('writeTarget', () => {
  it('follows the preview width on a fixed size', () => {
    expect(writeTarget(FOLLOW, FIXED, DEFAULT_BREAKPOINTS, 800)).toBe('md');
  });

  it('writes the base below the smallest breakpoint', () => {
    expect(writeTarget(FOLLOW, FIXED, DEFAULT_BREAKPOINTS, 375)).toBe(ALL_SIZES);
  });

  it('leaves the old behaviour on the full panel', () => {
    expect(writeTarget(FOLLOW, FULL, DEFAULT_BREAKPOINTS, 1400)).toBeUndefined();
  });

  it('honours an explicit choice whatever the width', () => {
    expect(writeTarget(ALL_SIZES, FIXED, DEFAULT_BREAKPOINTS, 1400)).toBe(ALL_SIZES);
    expect(writeTarget('lg', FIXED, DEFAULT_BREAKPOINTS, 375)).toBe('lg');
    expect(writeTarget('lg', FULL, DEFAULT_BREAKPOINTS, 375)).toBe('lg');
  });

  it('falls back to following when the chosen breakpoint is gone', () => {
    expect(writeTarget('tablet', FIXED, DEFAULT_BREAKPOINTS, 800)).toBe('md');
  });
});

describe('badgeText', () => {
  it('names the breakpoint and its width', () => {
    expect(badgeText(DEFAULT_BREAKPOINTS, 'md', 800)).toBe('editing: md ≥ 768px');
  });

  it('says all sizes', () => {
    expect(badgeText(DEFAULT_BREAKPOINTS, ALL_SIZES, 800)).toBe('editing: all sizes');
  });

  it('shows the width when it is automatic', () => {
    expect(badgeText(DEFAULT_BREAKPOINTS, undefined, 1100)).toBe('editing: auto · 1100px');
  });

  it('uses ≤ desktop-first and drops a name that repeats the width', () => {
    const desk = { direction: Direction.DesktopFirst, points: [{ name: '768px', px: 768 }] };
    expect(badgeText(desk, '768px', 700)).toBe('editing: ≤ 768px');
  });
});

describe('reachItems', () => {
  it('lists follow, all sizes, then each breakpoint', () => {
    const items = reachItems(DEFAULT_BREAKPOINTS);
    expect(items.slice(0, 3).map((i) => i.id)).toEqual([FOLLOW, ALL_SIZES, 'sm']);
    expect(items.find((i) => i.id === 'md')?.label).toBe('md ≥ 768px');
  });
});

describe('rowOverrides', () => {
  const row = (name: string) => ROWS.find((r) => r.name === name)!;

  it('finds the breakpoints that override a property', () => {
    expect(rowOverrides(row('font-size'), 'text-base md:text-lg lg:text-xl', DEFAULT_BREAKPOINTS)).toEqual(['md', 'lg']);
  });

  it('finds an overridden class family', () => {
    expect(rowOverrides(row('width'), 'w-full md:w-1/2', DEFAULT_BREAKPOINTS)).toEqual(['md']);
    expect(rowOverrides(row('max-width'), 'max-w-prose md:max-w-[720px]', DEFAULT_BREAKPOINTS)).toEqual(['md']);
    expect(rowOverrides(row('max-width'), 'w-full md:w-1/2', DEFAULT_BREAKPOINTS)).toEqual([]);
  });

  it('is empty without overrides', () => {
    expect(rowOverrides(row('font-size'), 'text-base flex md:flex', DEFAULT_BREAKPOINTS)).toEqual([]);
  });
});

describe('overrideTitle', () => {
  it('lists where the value is overridden', () => {
    expect(overrideTitle(['md', 'lg'], DEFAULT_BREAKPOINTS)).toBe('Overridden at md ≥ 768px, lg ≥ 1024px');
  });
});
