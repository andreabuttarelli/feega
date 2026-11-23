import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import EditorGuide from '../home/EditorGuide.svelte';
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

  describe('section', () => {
    const { body } = render(EditorGuide);

    it('references every screenshot', () => {
      GUIDE_FEATURES.forEach((feature) => expect(body, feature.src).toContain(`src="${feature.src}"`));
    });

    it('gives every feature a heading and an image with alt text for screen readers', () => {
      expect(body.match(/<h3[ >]/g)).toHaveLength(GUIDE_FEATURES.length);
      GUIDE_FEATURES.forEach((feature) => expect(body, feature.id).toContain(`alt="${feature.alt}"`));
    });

    it('hides the sticky copy of the screenshots from assistive tech', () => {
      expect(body).toMatch(/class="stage[^"]*" aria-hidden="true"/);
    });

    it('uses no tab roles', () => {
      expect(body).not.toContain('role="tab');
    });
  });
});
