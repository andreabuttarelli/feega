import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: { APP_SECRET: 'test-secret-for-grants' } }));

const { grantBearerOf, openAssetGrant, sealAssetGrant } = await import('./asset-grant');

const ASSET = 'https://feega.app/p/p1/c/c1/assets/a1';

describe('an asset grant lets a media element load a canvas file for its user', () => {
  it('seals the token so the URL does not show it, and opens back to it', () => {
    const grant = sealAssetGrant('jwt.token.value');
    expect(grant).not.toContain('jwt');
    expect(openAssetGrant(grant)).toBe('jwt.token.value');
  });

  it('a tampered grant opens to nothing', () => {
    const grant = sealAssetGrant('jwt.token.value');
    expect(openAssetGrant(`${grant.slice(0, -2)}xx`)).toBeNull();
    expect(openAssetGrant('garbage')).toBeNull();
  });

  it('signs in only a GET of a canvas asset', () => {
    const grant = sealAssetGrant('jwt');
    expect(grantBearerOf(new Request(`${ASSET}?size=256&grant=${grant}`))).toBe('jwt');
    expect(grantBearerOf(new Request(`https://feega.app/api/v1/me/root?grant=${grant}`))).toBeNull();
    expect(grantBearerOf(new Request(`${ASSET}?grant=${grant}`, { method: 'POST' }))).toBeNull();
    expect(grantBearerOf(new Request(`https://feega.app/p/p1/c/c1/motion/n1/live?grant=${grant}`))).toBe('jwt');
    expect(grantBearerOf(new Request(`https://feega.app/p/p1/c/c1/motion/n1/session?grant=${grant}`))).toBeNull();
  });
});
