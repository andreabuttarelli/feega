import { describe, expect, it } from 'vitest';
import { paidGateFor, promotePath, tabFromQuery, PROMOTE_TABS } from './promote-sheet';
import { SocialPublishing } from '$lib/social-publishing';

describe('promote sheet tabs', () => {
  it('opens on organic unless the link asks for paid', () => {
    expect(tabFromQuery(null, SocialPublishing.On)).toBe('organic');
    expect(tabFromQuery('bogus', SocialPublishing.On)).toBe('organic');
    expect(tabFromQuery('paid', SocialPublishing.On)).toBe('paid');
  });

  it('con la pubblicazione spenta resta solo l’annuncio a pagamento', () => {
    expect(tabFromQuery(null, SocialPublishing.Off)).toBe('paid');
    expect(tabFromQuery('organic', SocialPublishing.Off)).toBe('paid');
  });

  it('has exactly the two tabs, organic first', () => {
    expect(PROMOTE_TABS.map((t) => t.id)).toEqual(['organic', 'paid']);
  });
});

describe('paidGateFor', () => {
  const ready = { hasBrand: true, hasAdAccount: true, hasMedia: true };

  it.each([
    [{ ...ready, hasBrand: false, hasAdAccount: false }, 'no_brand'],
    [{ ...ready, hasAdAccount: false }, 'no_ad_account'],
    [{ ...ready, hasMedia: false }, 'no_media'],
    [ready, 'ready']
  ] as const)('%o → %s', (readiness, gate) => {
    expect(paidGateFor(readiness)).toBe(gate);
  });
});

describe('promotePath', () => {
  it('carries the selection and the tab', () => {
    expect(promotePath(['a', 'b'])).toBe('/promote?nodeIds=a,b');
    expect(promotePath([], 'paid')).toBe('/promote?tab=paid');
  });
});
