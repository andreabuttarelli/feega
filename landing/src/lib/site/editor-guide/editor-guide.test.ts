import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import EditorGuide from '../home/EditorGuide.svelte';
import { GUIDE_FEATURES, GuideId, GuideLayout } from '.';
import { MOCKS } from './mock/registry';

const STATIC_DIR = resolve(import.meta.dirname, '../../../../static');
const MIN_ALT = 40;
const EXPECTED_FEATURES = 6;

describe('editor guide', () => {
  it.each(GUIDE_FEATURES)('$id has alt text and what lands in code', (feature) => {
    expect(feature.alt.length).toBeGreaterThan(MIN_ALT);
    expect(feature.lands.length).toBeGreaterThan(0);
  });

  it('covers every feature once', () => {
    expect(GUIDE_FEATURES.map((f) => f.id).sort()).toEqual(Object.values(GuideId).sort());
  });

  it('gives every feature a mockup component', () => {
    Object.values(GuideId).forEach((id) => expect(MOCKS[id].component, id).toBeTruthy());
  });

  it('ships no screenshots of the editor', () => {
    expect(existsSync(resolve(STATIC_DIR, 'img/editor-guide'))).toBe(false);
  });

  describe('section', () => {
    const { body } = render(EditorGuide);

    it('draws every feature as exactly one mockup', () => {
      GUIDE_FEATURES.forEach((feature) => expect(body.split(`data-mock-for="${feature.id}"`), feature.id).toHaveLength(2));
    });

    it('uses no images', () => {
      expect(body).not.toContain('<img');
    });

    it('gives every feature a heading and its description for screen readers', () => {
      expect(body.match(/<h3[ >]/g)).toHaveLength(GUIDE_FEATURES.length);
      GUIDE_FEATURES.forEach((feature) => expect(body, feature.id).toContain(`>${feature.alt}</figcaption>`));
    });

    it('hides the mockups from assistive tech', () => {
      expect(body.match(/class="box[^"]*" aria-hidden="true"/g)).toHaveLength(GUIDE_FEATURES.length);
    });

    it('has no sticky stage', () => {
      expect(body).not.toContain('class="stage');
    });

    it('draws one hidden pixel icon above each heading', () => {
      expect(body.match(/<span class="icon[^"]*"><svg class="pixel"[^>]*shape-rendering="crispEdges" aria-hidden="true"/g)).toHaveLength(GUIDE_FEATURES.length);
      expect(new Set(GUIDE_FEATURES.map((f) => f.icon)).size).toBe(GUIDE_FEATURES.length);
    });

    it('lays out the last three features in a grid after three rows', () => {
      expect(GUIDE_FEATURES.map((f) => f.layout)).toEqual([...Array(3).fill(GuideLayout.Row), ...Array(3).fill(GuideLayout.Grid)]);
      expect(body.match(/<ul class="features grid[ "]/g)).toHaveLength(1);
      expect(body.match(/<li class="feature[^"]* cell[ "]/g)).toHaveLength(3);
    });

    it('keeps six features', () => {
      expect(GUIDE_FEATURES).toHaveLength(EXPECTED_FEATURES);
    });

    it('uses no tab roles', () => {
      expect(body).not.toContain('role="tab');
    });
  });
});
