import { describe, expect, it } from 'vitest';
import { FOOTER_LEGAL_LINKS, LEGAL_BASE_URL, LEGAL_LINKS, legalHref } from '$lib/legal-links';

describe('i link legali vivono in una sola tabella', () => {
  it('la base è il sito marketing pubblico', () => {
    expect(LEGAL_BASE_URL).toBe('https://feega.app');
  });

  it('ogni voce risolve sotto la base', () => {
    for (const key of Object.keys(LEGAL_LINKS) as (keyof typeof LEGAL_LINKS)[]) {
      expect(legalHref(key)).toBe(`${LEGAL_BASE_URL}${LEGAL_LINKS[key].path}`);
    }
  });

  it('le quattro pagine del modulo di accesso esistono', () => {
    expect(legalHref('terms')).toBe('https://feega.app/terms');
    expect(legalHref('acceptableUse')).toBe('https://feega.app/acceptable-use');
    expect(legalHref('privacy')).toBe('https://feega.app/privacy');
    expect(legalHref('cookies')).toBe('https://feega.app/cookies');
  });

  it('le cinque pagine aggiuntive del footer esistono', () => {
    expect(legalHref('refunds')).toBe('https://feega.app/refunds');
    expect(legalHref('aiTransparency')).toBe('https://feega.app/ai-transparency');
    expect(legalHref('dpa')).toBe('https://feega.app/dpa');
    expect(legalHref('subprocessors')).toBe('https://feega.app/subprocessors');
    expect(legalHref('legalNotice')).toBe('https://feega.app/legal-notice');
  });

  it('FOOTER_LEGAL_LINKS copre ogni chiave della tabella una sola volta', () => {
    expect(new Set(FOOTER_LEGAL_LINKS)).toEqual(new Set(Object.keys(LEGAL_LINKS)));
    expect(FOOTER_LEGAL_LINKS).toHaveLength(Object.keys(LEGAL_LINKS).length);
  });
});
