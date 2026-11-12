import { describe, expect, it } from 'vitest';
import { Platform, platformOf } from './platform';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Mobile/15E148 Safari/604.1';
const IPAD_DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.1 Safari/605.1.15';
const IPAD_MOBILE_UA = 'Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Mobile Safari/537.36';
const MAC_CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0 Safari/537.36';

describe('the platform a canvas session runs on', () => {
  it('names an iPhone', () => {
    expect(platformOf(IPHONE, 5)).toBe(Platform.IPhone);
  });

  it('names an iPad even when Safari sends the desktop Mac user agent', () => {
    expect(platformOf(IPAD_DESKTOP_UA, 5)).toBe(Platform.IPad);
    expect(platformOf(IPAD_MOBILE_UA, 5)).toBe(Platform.IPad);
  });

  it('keeps a Mac without a touch screen on the desktop', () => {
    expect(platformOf(IPAD_DESKTOP_UA, 0)).toBe(Platform.Desktop);
    expect(platformOf(MAC_CHROME, 0)).toBe(Platform.Desktop);
  });

  it('names Android', () => {
    expect(platformOf(ANDROID, 5)).toBe(Platform.Android);
  });
});
