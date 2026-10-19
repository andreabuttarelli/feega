import { describe, expect, it } from 'vitest';
import { detectInAppBrowser } from './in-app-browser';

const IOS_SHELL = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 FeegaNative/0.1.0';
const IOS_WEBVIEW = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';
const INSTAGRAM = `${IOS_WEBVIEW} Instagram 300.0`;

describe('detectInAppBrowser', () => {
  it('the feega shell is not an in-app browser: it hands OAuth to the system browser', () => {
    expect(detectInAppBrowser(IOS_SHELL).isInApp).toBe(false);
  });

  it('an unnamed iOS webview is still an in-app browser', () => {
    expect(detectInAppBrowser(IOS_WEBVIEW).isInApp).toBe(true);
  });

  it('a named host app is an in-app browser', () => {
    expect(detectInAppBrowser(INSTAGRAM)).toEqual({ isInApp: true, os: 'ios', app: 'Instagram' });
  });
});
