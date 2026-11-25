import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./Properties.svelte', import.meta.url), 'utf8');
const typography = source.slice(source.indexOf('data-section={Section.Typography}'), source.indexOf('data-section={Section.Fill}'));

const rowLabels = [...typography.matchAll(/@render row\('([^']+)'/g)].map((m) => m[1]);

describe('typography rows', () => {
  it('gives every control its own full-width row', () => {
    expect(rowLabels.slice(0, 5)).toEqual(['Font', 'Weight', 'Size', 'Line height', 'Letter spacing']);
  });

  it('never packs several controls side by side', () => {
    expect(typography).not.toMatch(/class="(pair|triple)/);
  });
});
