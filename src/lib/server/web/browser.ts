import type { Browser, CDPSession, HTTPRequest, Page } from 'puppeteer-core';
import { RequestVerdict, requestVerdict } from './screenshot';
import { CAPTURE_LIMITS, captureOf, framedNodes } from './vector-capture';
import type { RawCapture } from '$lib/motion/vector-ui/model';
import { OVERLAY_SELECTOR, type Overlay } from './overlays';
import { SnapMode, TREE_LIMITS, treeScript, type PageSnap, type PageTree } from '$lib/server/url-import/page-tree';
import { drawnInView, everythingInView, heldStill, inViewSampled, revealPage, type RevealMode, type Revealed, type Walk } from '$lib/server/url-import/page-reveal';
import { snapped, type Shoot } from '$lib/server/url-import/page-snaps';
import { componentMarksOf, MARK_LIMITS, type ComponentUse } from '$lib/server/code-import/component-marks';

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
export type UiElement = { tag: string; text: string; x: number; y: number; w: number; h: number; color?: string; background?: string; font?: string; size?: number; weight?: number; radius?: string; href?: string };
export type UiDigest = { title: string; elements: UiElement[] };

export type AppSession = { cookies: SessionCookie[]; storage: Record<string, string> };

export type AppTab = Tab & {
  session: () => Promise<AppSession>;
  restore: (session: AppSession, origin: string) => Promise<void>;
  label: (target: Target) => Promise<string>;
  ui: () => Promise<UiDigest>;
  vector: () => Promise<unknown>;
  tree: (maxHeight?: number) => Promise<unknown>;
  left: () => number;
  reveal: (mode: RevealMode) => Promise<Revealed>;
  seeAll: () => Promise<void>;
  sample: (walk?: Walk) => Promise<number>;
  viewport: (width: number) => Promise<void>;
  settle: (ms: number) => Promise<void>;
  marks: (names: string[]) => Promise<ComponentUse[]>;
  overlay: () => Promise<Overlay | null>;
  press: (key: string) => Promise<void>;
  paint: (html: string, size: { width: number; height: number }) => Promise<Buffer>;
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
const BROWSERLESS_SESSION_MS = 120_000;
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

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export function originHeaders(method: string, headers: Record<string, string>, pageUrl: string): Record<string, string> | null {
  if (SAFE_METHODS.includes(method) || headers.origin || !URL.canParse(pageUrl)) {
    return null;
  }
  return { ...headers, origin: new URL(pageUrl).origin };
}

async function gate(request: HTTPRequest): Promise<void> {
  const verdict = await requestVerdict(request.url());
  if (verdict !== RequestVerdict.Continue) {
    await request.abort('blockedbyclient').catch(() => undefined);
    return;
  }
  const headers = originHeaders(request.method(), request.headers(), request.frame()?.url() ?? '');
  await request.continue(headers ? { headers } : undefined).catch(() => undefined);
}

const LIGHT_SCHEME = [{ name: 'prefers-color-scheme', value: 'light' }];

async function fenced(page: Page): Promise<void> {
  await page.setViewport({ ...VIEWPORT, deviceScaleFactor: 1 });
  await page.emulateMediaFeatures(LIGHT_SCHEME);
  await page.setBypassCSP(true);
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
    elements.push({ tag: el.tagName.toLowerCase(), text, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height), color: css.color, background: css.backgroundColor, font: css.fontFamily.split(',')[0], size: parseFloat(css.fontSize), weight: Number(css.fontWeight), radius: css.borderRadius, ...(el instanceof HTMLAnchorElement && el.href ? { href: el.href } : {}) });
  }
  return { title: document.title, elements };
}

export async function vectorOfPage(page: Page): Promise<RawCapture> {
  const main = await page.evaluate(captureOf, CAPTURE_LIMITS);
  const inner = await Promise.all(
    page.mainFrame().childFrames().map(async (frame) => {
      const host = await frame.frameElement();
      const box = await host?.boundingBox();
      await host?.dispose();
      if (!box || box.width < 1 || box.height < 1) {
        return [];
      }
      const raw = await frame.evaluate(captureOf, CAPTURE_LIMITS).catch(() => null);
      return raw ? [framedNodes(raw, box)] : [];
    })
  );
  return { ...main, nodes: [...main.nodes, ...inner.flat().flat()] };
}

function overlayOf(selector: string): Overlay | null {
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const css = getComputedStyle(el);
    return r.width * r.height > 0.05 * innerWidth * innerHeight && css.visibility !== 'hidden' && css.display !== 'none' && Number(css.opacity) > 0;
  };
  const open = [...document.querySelectorAll(selector)].filter(visible).pop();
  if (!open) {
    return null;
  }
  const name = (b: Element) => (b.getAttribute('aria-label') || (b as HTMLElement).innerText || b.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
  return { buttons: [...open.querySelectorAll('button, [role="button"], a')].map(name).filter(Boolean) };
}

function labelOf(el: Element): string {
  return `${(el as HTMLElement).innerText ?? ''} ${el.getAttribute('aria-label') ?? ''} ${el.getAttribute('title') ?? ''} ${(el as HTMLInputElement).value ?? ''}`.replace(/\s+/g, ' ').trim();
}

const IDLE_MS = 500;
const LONG_LIVED_MS = 4_000;
const QUIET_POLL_MS = 100;
const FONTS_MS = 3_000;

function quietOf(page: Page): (ms: number) => Promise<void> {
  const inflight = new Map<HTTPRequest, number>();
  let changed = Date.now();
  page.on('request', (request) => {
    inflight.set(request, Date.now());
    changed = Date.now();
  });
  for (const ended of ['requestfinished', 'requestfailed'] as const) {
    page.on(ended, (request) => {
      inflight.delete(request);
      changed = Date.now();
    });
  }

  const quiet = () => {
    const now = Date.now();
    return now - changed >= IDLE_MS && [...inflight.values()].every((at) => now - at >= LONG_LIVED_MS);
  };
  return async (ms) => {
    const until = Date.now() + ms;
    while (!quiet() && Date.now() < until) {
      await pause(QUIET_POLL_MS);
    }
  };
}

const HIDE = `[${TREE_LIMITS.hideAttr}]`;
const hiddenWithin = (scope: string) => `${scope}${HIDE},${scope}${HIDE} *{visibility:hidden!important}`;
const shown = (target: string) => `${target},${target} *{visibility:visible!important}`;

const PAINT_SOURCES = 'clipPath,clipPath *,mask,mask *{visibility:visible!important}';

const SNAP_CSS: Record<SnapMode, (target: string) => string> = {
  [SnapMode.Isolated]: (target) => `html,body{background:transparent!important}body *{visibility:hidden!important}${PAINT_SOURCES}${shown(target)}${hiddenWithin(`${target} `)}`,
  [SnapMode.Own]: (target) => `html,body{background:transparent!important}body *{visibility:hidden!important}${PAINT_SOURCES}${target}{visibility:visible!important}`,
  [SnapMode.Backdrop]: (target) => `${hiddenWithin('')}${shown(target)}${hiddenWithin(`${target} `)}`
};

type SnapBox = PageSnap['box'];
type Held = { target: string; picture: string; box: SnapBox };
type SnapStage = { held: Held | null; style?: string | null; y: number; shot: { target: string; box: SnapBox } | null };
type SnapView = { live: boolean; scrolled: number };
type Piece = { data: Buffer; top: number };

const SEE_THROUGH = { color: { r: 0, g: 0, b: 0, a: 0 } };

function snapStaged(stage: SnapStage): SnapView {
  const LIVE = /^(CANVAS|VIDEO|IFRAME|EMBED|OBJECT)$/;
  const SAME_PX = 1;
  const STYLE_ID = 'feega-snap-style';
  const liveAt = (target: string, box: SnapBox) => {
    const el = document.querySelector<HTMLElement>(target);
    if (!el || !LIVE.test(el.tagName)) {
      return null;
    }
    const r = el.getBoundingClientRect();
    return Math.abs(r.width - box.width) <= SAME_PX && Math.abs(r.height - box.height) <= SAME_PX ? { el, r } : null;
  };

  const held = stage.held ? liveAt(stage.held.target, stage.held.box) : null;
  if (held && stage.held) {
    const still = document.createElement('img');
    still.src = stage.held.picture;
    still.className = held.el.className;
    still.style.cssText = `${held.el.style.cssText};width:${held.r.width}px;height:${held.r.height}px;object-fit:fill`;
    held.el.replaceWith(still);
  }

  if (stage.style !== undefined) {
    document.getElementById(STYLE_ID)?.remove();
  }
  if (stage.style) {
    const sheet = document.createElement('style');
    sheet.id = STYLE_ID;
    sheet.textContent = stage.style;
    (document.head ?? document.documentElement).append(sheet);
  }

  window.scrollTo({ top: stage.y, behavior: 'instant' });
  return { live: stage.shot ? liveAt(stage.shot.target, stage.shot.box) !== null : false, scrolled: window.scrollY };
}

async function cropped(viewport: Uint8Array, piece: SnapBox, scrolled: number): Promise<Buffer> {
  const { default: sharp } = await import('sharp');
  const shot = sharp(viewport);
  const { width = 0, height = 0 } = await shot.metadata();
  const left = Math.max(0, Math.round(piece.x));
  const top = Math.max(0, Math.round(piece.y - scrolled));
  const right = Math.min(width, Math.round(piece.x + piece.width));
  const bottom = Math.min(height, Math.round(piece.y - scrolled + piece.height));
  return shot.extract({ left, top, width: right - left, height: bottom - top }).png().toBuffer();
}

async function stitched(pieces: Piece[], box: SnapBox): Promise<string> {
  if (pieces.length === 1) {
    return pieces[0].data.toString('base64');
  }
  const { default: sharp } = await import('sharp');
  const size = { width: Math.round(box.width), height: Math.round(box.height) };
  const layers = pieces.map((piece) => ({ input: piece.data, top: piece.top, left: 0 }));
  return (await sharp({ create: { ...size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers).png().toBuffer()).toString('base64');
}

function camera(page: Page): { shoot: Shoot; done: () => Promise<void> } {
  let session: Promise<CDPSession> | null = null;
  let held: Held | null = null;
  let seeThrough = false;
  const cdp = () => (session ??= page.createCDPSession());

  const shoot: Shoot = async (snap) => {
    const target = `[${TREE_LIMITS.snapAttr}="${snap.ref}"]`;
    const transparent = snap.mode !== SnapMode.Backdrop;
    if (transparent !== seeThrough) {
      await (await cdp()).send('Emulation.setDefaultBackgroundColorOverride', transparent ? SEE_THROUGH : {});
      seeThrough = transparent;
    }

    const { height } = page.viewport() ?? VIEWPORT;
    const pieces: Piece[] = [];
    let live = false;
    for (let top = snap.box.y; top < snap.box.y + snap.box.height; top += height) {
      const piece = { x: snap.box.x, y: top, width: snap.box.width, height: Math.min(height, snap.box.y + snap.box.height - top) };
      const first = pieces.length === 0;
      const stage: SnapStage = first ? { held, style: SNAP_CSS[snap.mode](target), y: top + piece.height <= height ? 0 : top, shot: { target, box: snap.box } } : { held: null, y: top, shot: null };
      const view = await page.evaluate(snapStaged, stage);
      live ||= view.live;
      held = null;
      const data = await cropped(await page.screenshot({ type: 'png', optimizeForSpeed: true }), piece, view.scrolled);
      pieces.push({ data, top: Math.round(top - snap.box.y) });
    }

    const picture = `data:image/png;base64,${await stitched(pieces, snap.box)}`;
    held = live ? { target, picture, box: snap.box } : null;
    return picture;
  };

  const done = async () => {
    await page.evaluate(snapStaged, { held, style: null, y: 0, shot: null }).catch(() => undefined);
    held = null;
    if (!session) {
      return;
    }
    const opened = await session;
    if (seeThrough) {
      await opened.send('Emulation.setDefaultBackgroundColorOverride', {}).catch(() => undefined);
    }
    await opened.detach().catch(() => undefined);
  };

  return { shoot, done };
}

function tabOf(page: Page, close: () => Promise<number>, left: () => number): AppTab {
  const quiet = quietOf(page);
  return {
    goto: async (url) => {
      const until = Date.now() + NAV_TIMEOUT_MS;
      const response = await page.goto(url, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
      await quiet(until - Date.now());
      return response?.status() ?? null;
    },
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
    ui: () => page.evaluate(uiOf, { max: UI_MAX_ELEMENTS, text: UI_MAX_TEXT }),
    vector: () => vectorOfPage(page),
    tree: async (maxHeight = TREE_LIMITS.height) => {
      const read = (await page.evaluate(treeScript({ ...TREE_LIMITS, height: maxHeight }))) as PageTree;
      const lens = camera(page);
      return snapped(read, lens.shoot, left).finally(lens.done);
    },
    left,
    reveal: (mode) => page.evaluate(revealPage, mode),
    seeAll: async () => {
      await page.evaluateOnNewDocument(drawnInView);
      await page.evaluateOnNewDocument(everythingInView);
      await page.evaluateOnNewDocument(heldStill);
    },
    sample: (walk) => page.evaluate(inViewSampled, walk),
    viewport: (width) => page.setViewport({ ...VIEWPORT, width, deviceScaleFactor: 1 }),
    settle: async (ms) => {
      await quiet(ms);
      await page.evaluate((fontsMs) => Promise.race([document.fonts.ready, new Promise((done) => setTimeout(done, fontsMs))]), FONTS_MS).catch(() => undefined);
    },
    marks: (names) => page.evaluate(componentMarksOf, { names, limits: MARK_LIMITS, attr: TREE_LIMITS.useAttr }),
    overlay: () => page.evaluate(overlayOf, OVERLAY_SELECTOR),
    press: (key) => page.keyboard.press(key as Parameters<Page['keyboard']['press']>[0]),
    paint: async (html, size) => {
      await page.setContent(html, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
      await page.evaluate(() => document.fonts.ready);
      return Buffer.from(await page.screenshot({ type: 'jpeg', quality: JPEG_QUALITY, clip: { x: 0, y: 0, ...size } }));
    }
  };
}

export function localBrowser(newPage: () => Promise<Page>): OpenAppBrowser {
  return async () => {
    const page = await newPage();
    await fenced(page);
    return tabOf(
      page,
      async () => {
        await page.close().catch(() => undefined);
        return 0;
      },
      () => Infinity
    );
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
      return tabOf(page, close, () => started + BROWSERLESS_SESSION_MS - now());
    } catch (e) {
      await close();
      throw hidden(e, config.key);
    }
  };
}
