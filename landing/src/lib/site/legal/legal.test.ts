import { describe, expect, it } from 'vitest';
import { LEGAL_DOCS, isLegalSlug } from '.';
import { match } from '../../../params/legal';

describe('legal pages', () => {
  it.each(Object.keys(LEGAL_DOCS))('/%s resolves to a document with its own heading', (slug) => {
    expect(match(slug)).toBe(true);
    expect(LEGAL_DOCS[slug as keyof typeof LEGAL_DOCS].html).toMatch(/^<h1>/);
  });

  it('an unknown path stays a 404', () => {
    expect(isLegalSlug('pricing')).toBe(false);
    expect(isLegalSlug('toString')).toBe(false);
  });

  it('never links to the Framer CDN', () => {
    for (const doc of Object.values(LEGAL_DOCS)) {
      expect(doc.html).not.toContain('framerusercontent.com');
    }
  });
});
