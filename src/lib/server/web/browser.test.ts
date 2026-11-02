import { describe, it, expect, vi } from 'vitest';

vi.mock('$env/static/public', () => ({ PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }));
vi.mock('$env/dynamic/private', () => ({ env: {} }));

import type { Browser } from 'puppeteer-core';
import { BROWSERLESS_UNIT_USD, browserless, browserlessEndpoint, originHeaders } from './browser';
import { BrowserBusy, sessionSlots } from './browser-slots';

const KEY = 'secret-key';

function fakeBrowser() {
  const page = {
    setViewport: vi.fn(async () => undefined),
    setBypassCSP: vi.fn(async () => undefined),
    emulateMediaFeatures: vi.fn(async () => undefined),
    evaluateOnNewDocument: vi.fn(async () => undefined),
    setExtraHTTPHeaders: vi.fn(async () => undefined),
    setRequestInterception: vi.fn(async () => undefined),
    on: vi.fn(),
    createCDPSession: vi.fn(async () => ({ send: vi.fn(async () => undefined) })),
    goto: vi.fn(async () => ({ status: () => 200 })),
    waitForNetworkIdle: vi.fn(({ timeout }: { timeout: number }) => new Promise((_, reject) => setTimeout(reject, timeout))),
    evaluate: vi.fn(async () => undefined),
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

  it('keeps the session alive through a slow page import: stripe.com took ~80 s and lost its frame at 70 s', () => {
    const STRIPE_IMPORT_MS = 80_000;

    expect(Number(new URL(browserlessEndpoint({ key: KEY })).searchParams.get('timeout'))).toBeGreaterThan(STRIPE_IMPORT_MS * 1.4);
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

  it('reads a refusal that is an object, not an Error (the server build logged [object Object] and 429 was never recognised)', async () => {
    const { browser } = fakeBrowser();
    const refusedByPlan = { type: 'error', message: 'Unexpected server response: 429' };
    const connect = vi.fn().mockRejectedValueOnce(refusedByPlan).mockResolvedValueOnce(browser);

    await browserless({ key: KEY }, { connect, sleep: async () => undefined })();

    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('names the status of a refusal that only carries one', async () => {
    const connect = vi.fn().mockRejectedValue({ statusCode: 401 });

    await expect(browserless({ key: KEY }, { connect, sleep: async () => undefined })()).rejects.toThrow('401');
  });

  it('never reports [object Object]', async () => {
    const connect = vi.fn().mockRejectedValue({ reason: 'nope' });

    await expect(browserless({ key: KEY }, { connect, sleep: async () => undefined })()).rejects.toThrow(/nope/);
  });

  it('says busy once the rate limit outlasts every retry', async () => {
    const connect = vi.fn().mockRejectedValue(new Error('Unexpected server response: 429'));

    await expect(browserless({ key: KEY }, { connect, sleep: async () => undefined })()).rejects.toBeInstanceOf(BrowserBusy);
  });

  it('holds a slot while the tab is open and frees it on close', async () => {
    const { browser } = fakeBrowser();
    const slots = sessionSlots({ limit: 1, waitMs: 1 });
    const open = browserless({ key: KEY }, { connect: async () => browser, sleep: async () => undefined, slots });

    const tab = await open();
    await expect(open()).rejects.toBeInstanceOf(BrowserBusy);
    await tab.close();

    await expect(open()).resolves.toBeDefined();
  });

  it('frees the slot when the connection fails', async () => {
    const slots = sessionSlots({ limit: 1, waitMs: 1 });
    const connect = vi.fn().mockRejectedValue(new Error('Unexpected server response: 401'));

    await browserless({ key: KEY }, { connect, sleep: async () => undefined, slots })().catch(() => undefined);

    expect(slots.busy()).toBe(0);
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

  it('opens every page in light mode, so two imports of a light site never come back one light and one dark', async () => {
    const { browser, page } = fakeBrowser();

    await browserless({ key: KEY }, { connect: async () => browser, sleep: async () => undefined })();

    expect(page.emulateMediaFeatures).toHaveBeenCalledWith([{ name: 'prefers-color-scheme', value: 'light' }]);
    expect(page.setExtraHTTPHeaders).toHaveBeenCalledWith({ 'sec-ch-prefers-color-scheme': 'light' });
  });
});

describe('a page that keeps a few requests open forever', () => {
  const LONG_LIVED_MS = 4_000;
  const SETTLE_MS = 6_000;
  const neverEnding = { url: () => 'https://stripe.com/_workers/waveGeometry.worker.js', method: () => 'GET', headers: () => ({}), frame: () => null, continue: async () => undefined, abort: async () => undefined };

  it('opens on its load event and settles once only those are left (stripe on Browserless: a worker and two iframes never finish; goto and three settles waited 38 s)', async () => {
    vi.useFakeTimers();
    try {
      const { browser, page } = fakeBrowser();
      const tab = await browserless({ key: KEY }, { connect: async () => browser, sleep: async () => undefined })();
      const requested = () => (page.on.mock.calls as unknown as [string, (r: unknown) => void][]).filter(([event]) => event === 'request').forEach(([, listener]) => listener(neverEnding));
      requested();
      let opened = false;
      void tab.goto('https://stripe.com/').then(() => (opened = true));
      await vi.advanceTimersByTimeAsync(LONG_LIVED_MS * 1.5);
      expect(opened).toBe(true);
      requested();
      let settled = false;
      void tab.settle(SETTLE_MS).then(() => (settled = true));

      await vi.advanceTimersByTimeAsync(LONG_LIVED_MS / 2);
      const early = settled;
      await vi.advanceTimersByTimeAsync(LONG_LIVED_MS);

      expect(page.goto).toHaveBeenCalledWith('https://stripe.com/', expect.objectContaining({ waitUntil: 'load' }));
      expect(early).toBe(false);
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('the Origin a form post carries', () => {
  it('puts back the page origin the server-side Chromium drops, so a SvelteKit login is not refused as cross-site (v4 run: 403 on feega login)', () => {
    expect(originHeaders('POST', { 'content-type': 'application/x-www-form-urlencoded' }, 'http://localhost:5299/login')).toEqual({ 'content-type': 'application/x-www-form-urlencoded', origin: 'http://localhost:5299' });
  });

  it('leaves a GET, or a post that already has one, alone', () => {
    expect(originHeaders('GET', { a: '1' }, 'https://app.example/x')).toBeNull();
    expect(originHeaders('POST', { origin: 'https://app.example' }, 'https://app.example/x')).toBeNull();
  });
});
