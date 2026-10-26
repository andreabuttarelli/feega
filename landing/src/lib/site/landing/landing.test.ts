import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LANDING_PAGES, isLandingSlug, smallSrc } from '.';
import { match } from '../../../params/landing';
import { isLegalSlug } from '../legal';

describe('the SEO landing pages', () => {
  it.each(Object.keys(LANDING_PAGES))('/%s resolves to its page', (slug) => {
    expect(match(slug)).toBe(true);
  });

  it('never shares a path with a legal page', () => {
    expect(Object.keys(LANDING_PAGES).filter(isLegalSlug)).toEqual([]);
  });

  it('serves its images from this app, not the Framer CDN', () => {
    expect(JSON.stringify(LANDING_PAGES)).not.toContain('framerusercontent.com');
  });

  it('an unknown path stays a 404', () => {
    expect(isLandingSlug('toString')).toBe(false);
  });

  it('every image has its small variant on disk', () => {
    const srcs = [...JSON.stringify(LANDING_PAGES).matchAll(/"(\/site\/landing\/[^"]+\.webp)"/g)].map((m) => m[1]);
    expect(srcs.length).toBeGreaterThan(0);
    for (const src of srcs) {
      expect(existsSync(`static${smallSrc(src)}`)).toBe(true);
    }
  });
});
