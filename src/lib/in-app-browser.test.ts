import { describe, expect, it } from 'vitest';
import { detectInAppBrowser, guideFor, androidIntentUrl } from './in-app-browser';

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

const ANDROID_WEBVIEW = 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36';
const SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

describe('apps in the registry', () => {
  it.each([
    ['Threads', `${IOS_WEBVIEW} Barcelona 300`],
    ['WeChat', `${ANDROID_WEBVIEW} MicroMessenger/8.0`],
    ['Snapchat', `${IOS_WEBVIEW} Snapchat/12.0`],
    ['TikTok', `${IOS_WEBVIEW} musical_ly_30`],
    ['X', `${IOS_WEBVIEW} Twitter for iPhone`],
    ['Facebook', `${ANDROID_WEBVIEW} FBAV/400`]
  ])('%s is named', (app, ua) => {
    expect(detectInAppBrowser(ua).app).toBe(app);
  });

  it('Safari is not in-app', () => {
    expect(detectInAppBrowser(SAFARI).isInApp).toBe(false);
  });

  it('a bare Android webview is in-app without a name', () => {
    expect(detectInAppBrowser(ANDROID_WEBVIEW)).toEqual({ isInApp: true, os: 'android', app: null });
  });
});

describe('guideFor', () => {
  it('Instagram on iOS names the external browser menu entry', () => {
    const steps = guideFor(detectInAppBrowser(INSTAGRAM)).steps.join(' ');
    expect(steps).toContain('Open in external browser');
  });

  it('Instagram on Android points to Chrome', () => {
    const steps = guideFor({ isInApp: true, os: 'android', app: 'Instagram' }).steps.join(' ');
    expect(steps).toContain('Open in Chrome');
  });

  it('an unknown app still gets generic steps', () => {
    expect(guideFor({ isInApp: true, os: 'ios', app: null }).steps.length).toBeGreaterThan(1);
  });

  it('every registered app has steps for both platforms', () => {
    for (const app of ['Instagram', 'Facebook', 'Messenger', 'TikTok', 'LinkedIn', 'X', 'Threads', 'Snapchat', 'LINE', 'WeChat']) {
      expect(guideFor({ isInApp: true, os: 'ios', app }).steps.length).toBeGreaterThan(1);
      expect(guideFor({ isInApp: true, os: 'android', app }).steps.length).toBeGreaterThan(1);
    }
  });
});

describe('androidIntentUrl', () => {
  it('wraps the https url', () => {
    expect(androidIntentUrl('https://feega.app/login?a=1')).toBe(
      'intent://feega.app/login?a=1#Intent;scheme=https;action=android.intent.action.VIEW;end'
    );
  });
});
