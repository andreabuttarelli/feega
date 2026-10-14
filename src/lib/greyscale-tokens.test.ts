import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const CSS = readFileSync('src/app.css', 'utf8');
const AA = 4.5;
const SURFACE_STEP = 1.04;

type Theme = 'light' | 'dark';

const BLOCK: Record<Theme, RegExp> = {
  light: /^:root\s*\{([\s\S]*?)^\}/m,
  dark: /^:root\[data-theme="dark"\]\s*\{([\s\S]*?)^\}/m
};

function declared(theme: Theme): Record<string, string> {
  const body = BLOCK[theme].exec(CSS)?.[1] ?? '';
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim().toLowerCase()]));
}

function tokens(theme: Theme): Record<string, string> {
  const all = theme === 'light' ? declared('light') : { ...declared('light'), ...declared('dark') };
  const resolve = (value: string | undefined): string | undefined => {
    const ref = /^var\((--[\w-]+)\)$/.exec(value ?? '');
    return ref ? resolve(all[ref[1]]) : value;
  };
  return Object.fromEntries(
    Object.keys(all)
      .map((name) => [name, resolve(all[name])])
      .filter((entry): entry is [string, string] => /^#[0-9a-f]{6}$/.test(entry[1] ?? ''))
  );
}

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const linear = (c: number) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string) => {
  const [r, g, b] = channels(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const grey = (hex: string) => new Set(channels(hex)).size === 1;

const RAMP = Array.from({ length: 13 }, (_, i) => `--grey-${i}`);
const ROLE_TEXTS = ['--ui-text', '--ui-text-secondary', '--ui-text-tertiary', '--ui-icon-ink'];
const ROLE_GROUNDS = ['--ui-canvas', '--ui-panel', '--ui-panel-sunken', '--ui-panel-raised', '--ui-input', '--ui-wash'];
const NEUTRALS = ['--ui-bg', '--ui-surface', '--ui-hover', '--ui-field', '--ui-raised', '--ui-ink', '--ui-ink-2', '--ui-ink-3', '--canvas-bg', '--canvas-dot'];
const TEXTS = ['--ui-ink', '--ui-ink-2', '--ui-ink-3'];
const GROUNDS = ['--ui-bg', '--ui-surface', '--ui-field', '--canvas-bg'];

describe.each(['light', 'dark'] as const)('the %s greyscale', (theme) => {
  const t = tokens(theme);

  it('every chrome and canvas token is a true grey: colour is kept for selection and primary actions', () => {
    for (const name of NEUTRALS) {
      expect(t[name], name).toBeDefined();
      expect(grey(t[name]), `${name} ${t[name]}`).toBe(true);
    }
  });

  it('every text grey reads at WCAG AA on every ground it sits on', () => {
    for (const text of TEXTS) {
      for (const ground of GROUNDS) {
        expect(contrast(t[text], t[ground]), `${text} on ${ground}`).toBeGreaterThanOrEqual(AA);
      }
    }
  });

  it('the canvas is a grey of its own, a step away from the bars and panels around it', () => {
    expect(contrast(t['--canvas-bg'], t['--ui-surface'])).toBeGreaterThan(SURFACE_STEP);
    expect(contrast(t['--canvas-bg'], t['--ui-bg'])).toBeGreaterThan(SURFACE_STEP);
    expect(contrast(t['--canvas-dot'], t['--canvas-bg'])).toBeGreaterThan(SURFACE_STEP);
  });

  it('the ramp runs in thirteen true-grey steps, from the ground to the ink', () => {
    const lums = RAMP.map((name) => {
      expect(grey(t[name]), name).toBe(true);
      return luminance(t[name]);
    });
    const ordered = theme === 'light' ? [...lums].sort((a, b) => b - a) : [...lums].sort((a, b) => a - b);
    expect(lums).toEqual(ordered);
  });

  it('every role text reads at WCAG AA on every role surface', () => {
    for (const text of ROLE_TEXTS) {
      for (const ground of ROLE_GROUNDS) {
        expect(contrast(t[text], t[ground]), `${text} on ${ground}`).toBeGreaterThanOrEqual(AA);
      }
    }
  });

  it('the canvas sits below the panels, and panels below what floats over them', () => {
    expect(contrast(t['--ui-canvas'], t['--ui-panel'])).toBeGreaterThan(SURFACE_STEP);
    expect(contrast(t['--ui-panel-sunken'], t['--ui-panel'])).toBeGreaterThan(SURFACE_STEP);
    expect(contrast(t['--ui-divider'], t['--ui-panel'])).toBeGreaterThan(SURFACE_STEP);
  });

  it('white on the solid accent and the accent as text both read at AA', () => {
    expect(contrast(t['--ui-on-accent'], t['--ui-accent-solid'])).toBeGreaterThanOrEqual(AA);
    expect(contrast(t['--ui-accent-text'], t['--ui-panel'])).toBeGreaterThanOrEqual(AA);
  });
});
