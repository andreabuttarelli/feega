import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./Properties.svelte', import.meta.url), 'utf8');
const typography = source.slice(source.indexOf('data-section={Section.Typography}'), source.indexOf('data-section={Section.Fill}'));

const tag = source.slice(source.indexOf('data-section={Section.Tag}'), source.indexOf('data-section={Section.Typography}'));

const rowLabels = [...typography.matchAll(/@render row\('([^']+)'/g)].map((m) => m[1]);

describe('typography rows', () => {
  it('gives every control its own full-width row', () => {
    expect(rowLabels.slice(0, 5)).toEqual(['Font', 'Weight', 'Size', 'Line height', 'Letter spacing']);
  });

  it('never packs several controls side by side', () => {
    expect(typography).not.toMatch(/class="(pair|triple)/);
  });
});

describe('tag section', () => {
  it('is its own section before Typography, not a Typography row', () => {
    expect(source.indexOf('data-section={Section.Tag}')).toBeGreaterThan(-1);
    expect(source.indexOf('data-section={Section.Tag}')).toBeLessThan(source.indexOf('data-section={Section.Typography}'));
    expect(tag).toContain("@render row('Tag'");
    expect(rowLabels).not.toContain('Tag');
  });
});
