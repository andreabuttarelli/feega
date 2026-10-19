import { describe, expect, it } from 'vitest';
import { BundleAuthPage, bundleAuthRoute, nextAfterSignIn, oauthReturnUrl } from './bundle-auth';

describe('in the bundle, sign-in pages are the client-only ones', () => {
  it('the server login, callback and sign-out become their bundle pages', () => {
    expect(bundleAuthRoute('/login')).toBe(BundleAuthPage.SignIn);
    expect(bundleAuthRoute('/auth/callback')).toBe(BundleAuthPage.Callback);
    expect(bundleAuthRoute('/auth/signout')).toBe(BundleAuthPage.SignOut);
    expect(bundleAuthRoute('/app')).toBeNull();
  });

  it('OAuth comes back through the app scheme the shells already route', () => {
    expect(oauthReturnUrl('/p/p1')).toBe('feega://auth/callback?next=%2Fp%2Fp1');
  });

  it('after sign-in it goes where it was asked, inside the app only', () => {
    expect(nextAfterSignIn('/p/p1/c/c1')).toBe('/p/p1/c/c1');
    expect(nextAfterSignIn(null)).toBe('/app');
    expect(nextAfterSignIn('https://evil.example')).toBe('/app');
    expect(nextAfterSignIn('//evil.example')).toBe('/app');
  });
});
