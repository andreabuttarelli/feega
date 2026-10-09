import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));

import type { Browser } from 'puppeteer-core';
import { BROWSERLESS_UNIT_USD, browserless, browserlessEndpoint } from './browser';

const KEY = 'secret-key';

function fakeBrowser() {
  const page = {
    setViewport: vi.fn(async () => undefined),
    setRequestInterception: vi.fn(async () => undefined),
    on: vi.fn(),
    createCDPSession: vi.fn(async () => ({ send: vi.fn(async () => undefined) })),
    close: vi.fn(async () => undefined)
  };
  const browser = { newPage: vi.fn(async () => page), close: vi.fn(async () => undefined) };
  return { browser: browser as unknown as Browser, page, close: browser.close };
}

describe('browserless: a hosted browser behind the same tab', () => {
  it('connects to the stealth route with a session timeout and no CAPTCHA solving or proxy', () => {
    const endpoint = new URL(browserlessEndpoint({ key: KEY }));

    expect(endpoint.protocol).toBe('wss:');
    expect(endpoint.host).toBe('production-sfo.browserless.io');
    expect(endpoint.pathname).toBe('/stealth');
    expect(endpoint.searchParams.get('token')).toBe(KEY);
    expect(Number(endpoint.searchParams.get('timeout'))).toBeGreaterThan(0);
    expect(endpoint.searchParams.has('solveCaptchas')).toBe(false);
    expect(endpoint.searchParams.has('proxy')).toBe(false);
  });

  it('follows the region of a configured base url', () => {
    expect(new URL(browserlessEndpoint({ key: KEY, base: 'https://production-lon.browserless.io/' })).host).toBe('production-lon.browserless.io');
  });

  it('retries a rate limit with backoff, then opens', async () => {
    const { browser } = fakeBrowser();
    const connect = vi.fn().mockRejectedValueOnce(new Error('Unexpected server response: 429')).mockResolvedValueOnce(browser);
    const sleep = vi.fn(async () => undefined);

    await browserless({ key: KEY }, { connect, sleep })();

    expect(connect).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('does not retry what a retry cannot fix', async () => {
    const connect = vi.fn().mockRejectedValue(new Error('Unexpected server response: 401'));

    await expect(browserless({ key: KEY }, { connect, sleep: async () => undefined })()).rejects.toThrow('401');
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it('never shows the key in an error', async () => {
    const connect = vi.fn().mockRejectedValue(new Error(`connect failed wss://production-sfo.browserless.io/stealth?token=${KEY}`));

    await expect(browserless({ key: KEY }, { connect, sleep: async () => undefined })()).rejects.toThrow(/^(?!.*secret-key)/);
  });

  it('bills whole 30-second units on close and meters them', async () => {
    const { browser, close } = fakeBrowser();
    let now = 0;
    const meter = vi.fn();
    const tab = await browserless({ key: KEY }, { connect: async () => browser, sleep: async () => undefined, now: () => now, meter })();

    now = 31_000;
    const usd = await tab.close();

    expect(close).toHaveBeenCalled();
    expect(usd).toBeCloseTo(2 * BROWSERLESS_UNIT_USD);
    expect(meter).toHaveBeenCalledWith({ ms: 31_000, units: 2, usd: 2 * BROWSERLESS_UNIT_USD });
  });

  it('gates every request of the hosted page too', async () => {
    const { browser, page } = fakeBrowser();

    await browserless({ key: KEY }, { connect: async () => browser, sleep: async () => undefined })();

    expect(page.setRequestInterception).toHaveBeenCalledWith(true);
    expect(page.on).toHaveBeenCalledWith('request', expect.any(Function));
  });
});
