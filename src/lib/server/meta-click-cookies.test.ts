import { describe, expect, it } from 'vitest';
import { CONSENT_COOKIE, CONSENT_VERSION, encodeConsent } from '$lib/consent-model';
import { seedMetaClickCookies } from './meta-click-cookies';

function jar(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get: (name: string) => values.get(name),
    set: (name: string, value: string) => void values.set(name, value),
    values
  };
}

const AD_CLICK = new URL('https://oh.feega.app/?fbclid=abc');
const consent = (marketing: boolean) =>
  encodeConsent({ version: CONSENT_VERSION, at: 1, analytics: false, marketing });

describe('i cookie di un click Meta aspettano il consenso marketing', () => {
  it('senza scelta non scrive _fbc né _fbp', () => {
    const cookies = jar();
    seedMetaClickCookies(cookies, AD_CLICK, '/');
    expect(cookies.values.has('_fbc')).toBe(false);
    expect(cookies.values.has('_fbp')).toBe(false);
  });

  it('con marketing negato non scrive nulla', () => {
    const cookies = jar({ [CONSENT_COOKIE]: consent(false) });
    seedMetaClickCookies(cookies, AD_CLICK, '/');
    expect(cookies.values.has('_fbc')).toBe(false);
  });

  it('con marketing concesso scrive entrambi', () => {
    const cookies = jar({ [CONSENT_COOKIE]: consent(true) });
    seedMetaClickCookies(cookies, AD_CLICK, '/');
    expect(cookies.values.get('_fbc')).toMatch(/^fb\.1\.\d+\.abc$/);
    expect(cookies.values.get('_fbp')).toMatch(/^fb\.1\./);
  });

  it('mai sui blog dei brand', () => {
    const cookies = jar({ [CONSENT_COOKIE]: consent(true) });
    seedMetaClickCookies(cookies, AD_CLICK, '/_site/[slug]');
    expect(cookies.values.has('_fbc')).toBe(false);
  });
});
