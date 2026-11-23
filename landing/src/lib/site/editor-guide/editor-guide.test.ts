import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GUIDE_FEATURES, GuideId } from '.';

const STATIC_DIR = resolve(import.meta.dirname, '../../../../static');
const MIN_ALT = 40;

describe('editor guide', () => {
  it.each(GUIDE_FEATURES)('$id ships a real screenshot, alt text and what lands in code', (feature) => {
    expect(existsSync(resolve(STATIC_DIR, feature.src.slice(1))), feature.src).toBe(true);
    expect(feature.alt.length).toBeGreaterThan(MIN_ALT);
    expect(feature.lands.length).toBeGreaterThan(0);
  });

  it('covers every feature once', () => {
    expect(GUIDE_FEATURES.map((f) => f.id).sort()).toEqual(Object.values(GuideId).sort());
  });
});
