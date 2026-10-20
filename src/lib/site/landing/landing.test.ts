import { describe, expect, it } from 'vitest';
import { LANDING_PAGES, isLandingSlug } from '.';
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
});
