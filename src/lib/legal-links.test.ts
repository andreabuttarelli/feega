import { describe, expect, it } from 'vitest';
import { FOOTER_LEGAL_LINKS, LEGAL_LINKS, legalHref } from '$lib/legal-links';

describe('i link legali vivono in una sola tabella', () => {
  it('la base è il sito marketing pubblico', () => {
  });

  it('ogni voce risolve sotto la base', () => {
    for (const key of Object.keys(LEGAL_LINKS) as (keyof typeof LEGAL_LINKS)[]) {
      expect(legalHref(key)).toBe(`https://feega.app${LEGAL_LINKS[key].path}`);
    }
  });

  it('le tre pagine del modulo di accesso esistono', () => {
    expect(legalHref('terms')).toBe('https://feega.app/terms');
    expect(legalHref('privacy')).toBe('https://feega.app/privacy');
    expect(legalHref('cookies')).toBe('https://feega.app/cookies');
  });

  it('FOOTER_LEGAL_LINKS copre ogni chiave della tabella una sola volta', () => {
    expect(new Set(FOOTER_LEGAL_LINKS)).toEqual(new Set(Object.keys(LEGAL_LINKS)));
    expect(FOOTER_LEGAL_LINKS).toHaveLength(Object.keys(LEGAL_LINKS).length);
  });
});
