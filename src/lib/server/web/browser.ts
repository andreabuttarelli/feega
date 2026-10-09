import type { Browser, HTTPRequest, Page } from 'puppeteer-core';
import { RequestVerdict, requestVerdict } from './screenshot';

export type Target = { selector?: string; text?: string };
export type ScrollTo = { px?: number; to?: 'top' | 'bottom' };
export type RenderedLook = { background: string | null; text: string | null; button: string | null; body: string | null; heading: string | null };

export type Tab = {
  goto: (url: string) => Promise<number | null>;
  url: () => string;
  html: () => Promise<string>;
  look: () => Promise<RenderedLook>;
  click: (target: Target) => Promise<void>;
  type: (selector: string, text: string) => Promise<void>;
  scroll: (to: ScrollTo) => Promise<void>;
  waitFor: (selector: string, ms: number) => Promise<void>;
  sensitive: (target: Target) => Promise<boolean>;
  shot: () => Promise<Buffer>;
  close: () => Promise<number>;
};

export type OpenBrowser = () => Promise<Tab>;

export type BrowserlessConfig = { key: string; base?: string };
export type BrowserlessUse = { ms: number; units: number; usd: number };
export type BrowserlessPorts = {
  connect: (endpoint: string) => Promise<Browser>;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  meter?: (use: BrowserlessUse) => void;
};

export const BROWSERLESS_DEFAULT_BASE = 'https://production-sfo.browserless.io';
export const BROWSERLESS_UNIT_USD = 0.002;
const BROWSERLESS_UNIT_MS = 30_000;
const BROWSERLESS_SESSION_MS = 70_000;
const STEALTH_ROUTE = '/stealth';
const RETRY_DELAYS_MS = [1_000, 3_000];
const RETRYABLE = /\b(429|503)\b|too many|rate limit/i;
const VIEWPORT = { width: 1280, height: 800 };
const NAV_TIMEOUT_MS = 20_000;
const JPEG_QUALITY = 70;
const REDACTED = '[redacted]';

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function browserlessEndpoint(config: BrowserlessConfig): string {
  const url = new URL(STEALTH_ROUTE, (config.base || BROWSERLESS_DEFAULT_BASE).replace(/^http/i, 'ws'));
  url.searchParams.set('token', config.key);
  url.searchParams.set('timeout', String(BROWSERLESS_SESSION_MS));
  return url.toString();
}

export const unitsOf = (ms: number) => Math.max(1, Math.ceil(ms / BROWSERLESS_UNIT_MS));

async function gate(request: HTTPRequest): Promise<void> {
  const verdict = await requestVerdict(request.url());
  await (verdict === RequestVerdict.Continue ? request.continue() : request.abort('blockedbyclient')).catch(() => undefined);
}

async function fenced(page: Page): Promise<void> {
  await page.setViewport({ ...VIEWPORT, deviceScaleFactor: 1 });
  await page.setRequestInterception(true);
  page.on('request', (request) => void gate(request));
  const cdp = await page.createCDPSession();
  await cdp.send('Browser.setDownloadBehavior', { behavior: 'deny' }).catch(() => undefined);
}

const locator = (target: Target) => target.selector ?? `::-p-text(${target.text ?? ''})`;

function lookOf(): RenderedLook {
  const hex = (colour: string) => {
    const m = colour.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
    if (!m || (m[4] !== undefined && Number(m[4]) === 0)) {
      return null;
    }
    return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  };
  const body = getComputedStyle(document.body);
  const button = document.querySelector('button, [role=button], a[class*="btn"], a[class*="button"], a[class*="cta"]');
  const heading = document.querySelector('h1');
  return {
    background: hex(body.backgroundColor),
    text: hex(body.color),
    button: button ? hex(getComputedStyle(button).backgroundColor) : null,
    body: body.fontFamily || null,
    heading: heading ? getComputedStyle(heading).fontFamily : null
  };
}

function sensitiveField(el: Element): boolean {
  const risky = (input: Element) => {
    const field = input as HTMLInputElement;
    const said = `${field.autocomplete ?? ''} ${field.name ?? ''} ${field.id ?? ''}`;
    return field.type === 'password' || /cc-|card|cvc|cvv|iban|security.?code/i.test(said);
  };
  const form = el.closest('form');
  return risky(el) || (form ? [...form.querySelectorAll('input')].some(risky) : false);
}

function tabOf(page: Page, close: () => Promise<number>): Tab {
  return {
    goto: async (url) => (await page.goto(url, { waitUntil: 'networkidle2', timeout: NAV_TIMEOUT_MS }))?.status() ?? null,
    url: () => page.url(),
    html: () => page.content(),
    look: () => page.evaluate(lookOf),
    click: (target) => page.locator(locator(target)).click(),
    type: (selector, text) => page.locator(selector).fill(text),
    scroll: (to) => page.evaluate((s) => window.scrollTo(0, s.to === 'bottom' ? document.body.scrollHeight : s.to === 'top' ? 0 : window.scrollY + (s.px ?? 0)), to),
    waitFor: async (selector, ms) => {
      await page.waitForSelector(selector, { timeout: ms });
    },
    sensitive: async (target) => {
      const handle = await page.$(locator(target));
      return handle ? handle.evaluate(sensitiveField).finally(() => handle.dispose()) : false;
    },
    shot: async () => Buffer.from(await page.screenshot({ type: 'jpeg', quality: JPEG_QUALITY })),
    close
  };
}

export function localBrowser(newPage: () => Promise<Page>): OpenBrowser {
  return async () => {
    const page = await newPage();
    await fenced(page);
    return tabOf(page, async () => {
      await page.close().catch(() => undefined);
      return 0;
    });
  };
}

function hidden(e: unknown, key: string): Error {
  return new Error((e instanceof Error ? e.message : String(e)).split(key).join(REDACTED));
}

async function connected(config: BrowserlessConfig, ports: BrowserlessPorts): Promise<Browser> {
  const sleep = ports.sleep ?? pause;
  for (let attempt = 0; ; attempt++) {
    try {
      return await ports.connect(browserlessEndpoint(config));
    } catch (e) {
      const error = hidden(e, config.key);
      if (attempt >= RETRY_DELAYS_MS.length || !RETRYABLE.test(error.message)) {
        throw error;
      }
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

export function browserless(config: BrowserlessConfig, ports: BrowserlessPorts): OpenBrowser {
  const now = ports.now ?? Date.now;
  return async () => {
    const started = now();
    const browser = await connected(config, ports);
    const close = async () => {
      await browser.close().catch(() => undefined);
      const ms = now() - started;
      const units = unitsOf(ms);
      const usd = units * BROWSERLESS_UNIT_USD;
      ports.meter?.({ ms, units, usd });
      return usd;
    };
    try {
      const page = await browser.newPage();
      await fenced(page);
      return tabOf(page, close);
    } catch (e) {
      await close();
      throw hidden(e, config.key);
    }
  };
}
