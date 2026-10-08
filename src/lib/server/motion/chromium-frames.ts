import type { Browser, Page } from 'puppeteer-core';
import shaderRuntime from 'virtual:motion-shader-fx';
import type { BrowserPort, FramePage, Viewport } from './server-frames';
import type { GlPage } from '$lib/server/effects/check';

const CHROMIUM_VERSION = '153.0.0';
const CHROMIUM_PACK = `https://github.com/Sparticuz/chromium/releases/download/v${CHROMIUM_VERSION}/chromium-v${CHROMIUM_VERSION}-pack.x64.tar`;
const LOAD_TIMEOUT_MS = 20_000;
const SEEK_TIMEOUT_MS = 10_000;
const MEDIA_TIMEOUT_MS = 8_000;

type Stage = Window & {
  __player?: { renderSeek: (t: number) => void };
  __playerReady?: boolean;
  __renderReady?: boolean;
  __fontsReady?: Promise<unknown>;
  __hfWaitForSeekCompletion?: () => Promise<unknown>;
};

let shared: Promise<Browser> | null = null;

async function launch(): Promise<Browser> {
  const [{ default: chromium }, { default: puppeteer }] = await Promise.all([import('@sparticuz/chromium-min'), import('puppeteer-core')]);
  const executablePath = process.env.CHROMIUM_PATH ?? (await chromium.executablePath(process.env.CHROMIUM_PACK_URL ?? CHROMIUM_PACK));
  return puppeteer.launch({ executablePath, args: chromium.args, headless: 'shell' });
}

async function browser(): Promise<Browser> {
  const open = await (shared ??= launch());
  if (open.connected) {
    return open;
  }
  shared = launch();
  return shared;
}

async function load(page: Page, html: string) {
  await page.setContent(html, { waitUntil: 'load', timeout: LOAD_TIMEOUT_MS });
  await page.waitForFunction(() => Boolean((window as Stage).__playerReady && (window as Stage).__renderReady), { timeout: LOAD_TIMEOUT_MS });
  await page.evaluate(() => (window as Stage).__fontsReady);
}

async function seek(page: Page, seconds: number) {
  await page.evaluate(
    async (t, mediaMs) => {
      const stage = window as Stage;
      stage.__player?.renderSeek(t);
      await stage.__hfWaitForSeekCompletion?.();
      const seeked = (v: HTMLVideoElement) =>
        new Promise((r) => {
          v.addEventListener('seeked', r, { once: true });
          setTimeout(r, mediaMs);
        });
      const settled = (v: HTMLVideoElement) => (v.seeking || v.readyState < 2 ? seeked(v) : null);
      await Promise.all([...document.querySelectorAll('video')].map(settled));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    },
    seconds,
    MEDIA_TIMEOUT_MS
  );
}

async function pageOf(viewport: Viewport): Promise<FramePage> {
  const page = await (await browser()).newPage();
  page.setDefaultTimeout(SEEK_TIMEOUT_MS);
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.scale });
  return {
    load: (html) => load(page, html),
    seek: (seconds) => seek(page, seconds),
    jpeg: async (quality) => Buffer.from(await page.screenshot({ type: 'jpeg', quality })),
    close: () => page.close()
  };
}

export const serverFramesOpen = () => Boolean(process.env.VERCEL || process.env.CHROMIUM_PATH);

export const chromiumFrames: BrowserPort = { open: pageOf };

async function runGl<T>(script: string): Promise<T> {
  const page = await (await browser()).newPage();
  try {
    await page.setContent(`<script>${shaderRuntime.replace(/<\/script/gi, '<\\/script')}</script>`, { waitUntil: 'load', timeout: LOAD_TIMEOUT_MS });
    return (await page.evaluate(script)) as T;
  } finally {
    await page.close();
  }
}

export const chromiumGl: GlPage = { run: runGl };
