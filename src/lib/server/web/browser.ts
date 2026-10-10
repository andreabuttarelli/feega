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

export type SessionCookie = { name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean };
export type UiElement = { tag: string; text: string; x: number; y: number; w: number; h: number; color?: string; background?: string; font?: string; size?: number; weight?: number; radius?: string };
export type UiDigest = { title: string; elements: UiElement[] };

export type AppSession = { cookies: SessionCookie[]; storage: Record<string, string> };

export type AppTab = Tab & {
  session: () => Promise<AppSession>;
  restore: (session: AppSession, origin: string) => Promise<void>;
  label: (target: Target) => Promise<string>;
  ui: () => Promise<UiDigest>;
};

export type OpenBrowser = () => Promise<Tab>;
export type OpenAppBrowser = () => Promise<AppTab>;

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

const UI_MAX_ELEMENTS = 160;
const UI_MAX_TEXT = 120;

function uiOf(limits: { max: number; text: number }): UiDigest {
  const PICKED = 'h1, h2, h3, h4, nav a, aside a, button, [role=button], [role=tab], a, label, input, select, textarea, th, td, li, p, span, img, svg';
  const elements: UiElement[] = [];
  for (const el of document.querySelectorAll(PICKED)) {
    if (elements.length >= limits.max) {
      break;
    }
    const rect = el.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4 || rect.bottom < 0 || rect.top > window.innerHeight) {
      continue;
    }
    const field = el as HTMLInputElement;
    const own = [...el.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? '').join(' ').trim();
    const text = (el.matches('input, textarea, select') ? field.placeholder || field.getAttribute('aria-label') || '' : el.matches('img, svg') ? el.getAttribute('alt') || el.getAttribute('aria-label') || '' : own || (el.matches('button, a, [role=button], [role=tab], label, th, td') ? (el as HTMLElement).innerText : '')).replace(/\s+/g, ' ').trim().slice(0, limits.text);
    if (!text && !el.matches('input, img, svg, button')) {
      continue;
    }
    const css = getComputedStyle(el);
    elements.push({ tag: el.tagName.toLowerCase(), text, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height), color: css.color, background: css.backgroundColor, font: css.fontFamily.split(',')[0], size: parseFloat(css.fontSize), weight: Number(css.fontWeight), radius: css.borderRadius });
  }
  return { title: document.title, elements };
}

function labelOf(el: Element): string {
  return `${(el as HTMLElement).innerText ?? ''} ${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''} ${(el as HTMLInputElement).value ?? ''}`.replace(/\s+/g, ' ').trim();
}

function tabOf(page: Page, close: () => Promise<number>): AppTab {
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
    close,
    session: async () => ({
      cookies: (await page.browser().cookies()).map(({ name, value, domain, path, expires, httpOnly, secure }) => ({ name, value, domain, path, expires, httpOnly: httpOnly ?? false, secure })),
      storage: await page.evaluate(() => Object.fromEntries(Object.entries(localStorage))).catch(() => ({}))
    }),
    restore: async (session, origin) => {
      await page.browser().setCookie(...session.cookies);
      await page.evaluateOnNewDocument(
        (at: string, items: Record<string, string>) => {
          if (location.origin === at) {
            Object.entries(items).forEach(([k, v]) => localStorage.setItem(k, v));
          }
        },
        origin,
        session.storage
      );
    },
    label: async (target) => {
      const handle = await page.$(locator(target));
      return handle ? handle.evaluate(labelOf).finally(() => handle.dispose()) : '';
    },
    ui: () => page.evaluate(uiOf, { max: UI_MAX_ELEMENTS, text: UI_MAX_TEXT })
  };
}

export function localBrowser(newPage: () => Promise<Page>): OpenAppBrowser {
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

export function browserless(config: BrowserlessConfig, ports: BrowserlessPorts): OpenAppBrowser {
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
