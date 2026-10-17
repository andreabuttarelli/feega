import { describe, expect, it } from 'vitest';
import { detectInAppBrowser } from './in-app-browser';

const IOS_WEBVIEW = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

describe('who cannot run OAuth in place', () => {
  it('an unnamed iOS webview is an in-app browser', () => {
    expect(detectInAppBrowser(IOS_WEBVIEW).isInApp).toBe(true);
  });

  it('the feega shell is not: it sends OAuth to the system browser itself', () => {
    expect(detectInAppBrowser(`${IOS_WEBVIEW} FeegaNative/0.1.0`).isInApp).toBe(false);
    expect(detectInAppBrowser('Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 FeegaNative/0.1.0').isInApp).toBe(false);
  });
});
