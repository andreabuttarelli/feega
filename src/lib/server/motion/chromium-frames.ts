import { existsSync } from 'node:fs';
import type { Browser, Page } from 'puppeteer-core';
import shaderRuntime from 'virtual:motion-shader-fx';
import type { ExportPage, ExportPort, PageBox, StillPage, StillPort, Viewport } from './server-frames';
import { freezePage } from '$lib/motion/export-vector';
import { Pose, kindsOf, measureClips } from '$lib/motion/hyperframes/measure';
import type { GlPage } from '$lib/server/effects/check';

const CHROMIUM_VERSION = '153.0.0';
const CHROMIUM_PACK = `https://github.com/Sparticuz/chromium/releases/download/v${CHROMIUM_VERSION}/chromium-v${CHROMIUM_VERSION}-pack.x64.tar`;
const LOAD_TIMEOUT_MS = 20_000;
const SEEK_TIMEOUT_MS = 10_000;
const MEDIA_TIMEOUT_MS = 8_000;

type Stage = Window & {
  __player?: { renderSeek: (t: number, options: { exact: boolean }) => void };
  __playerReady?: boolean;
  __renderReady?: boolean;
  __fontsReady?: Promise<unknown>;
  __hfWaitForSeekCompletion?: () => Promise<unknown>;
};

const LOCAL_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser'
];

function localChromium(): string | null {
  if (process.env.CHROMIUM_PATH) {
    return process.env.CHROMIUM_PATH;
  }
  if (process.env.VERCEL || process.env.NODE_ENV === 'test') {
    return null;
  }
  return LOCAL_CHROME_PATHS.find((path) => existsSync(path)) ?? null;
}

let shared: Promise<Browser> | null = null;

async function launch(): Promise<Browser> {
  const [{ default: chromium }, { default: puppeteer }] = await Promise.all([import('@sparticuz/chromium-min'), import('puppeteer-core')]);
  const local = localChromium();
  if (local) {
    return puppeteer.launch({ executablePath: local, headless: 'shell' });
  }
  const executablePath = await chromium.executablePath(process.env.CHROMIUM_PACK_URL ?? CHROMIUM_PACK);
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
      stage.__player?.renderSeek(t, { exact: true });
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

const SCREENSHOT_TYPE: Record<string, 'png' | 'jpeg' | 'webp'> = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' };

async function openPage(viewport: Viewport): Promise<Page> {
  const page = await (await browser()).newPage();
  page.setDefaultTimeout(SEEK_TIMEOUT_MS);
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.scale });
  return page;
}

function stillOf(page: Page): StillPage {
  return {
    load: (html) => load(page, html),
    seek: (seconds) => seek(page, seconds),
    jpeg: async (quality) => Buffer.from(await page.screenshot({ type: 'jpeg', quality })),
    picture: async (mime, quality) => Buffer.from(await page.screenshot({ type: SCREENSHOT_TYPE[mime], quality, omitBackground: true })),
    close: () => page.close()
  };
}

const pageOf = async (viewport: Viewport): Promise<StillPage> => stillOf(await openPage(viewport));

async function boxOf(page: Page, clipId: string): Promise<PageBox | null> {
  const found = (await page.evaluate(`(function(){var root=document.getElementById('root');if(!root){return null;}var r=root.getBoundingClientRect();var b=(${measureClips.toString()})(root,${JSON.stringify(kindsOf(Pose.Base))})[${JSON.stringify(clipId)}];return b?{left:b.left*r.width,top:b.top*r.height,width:b.width*r.width,height:b.height*r.height}:null;})()`)) as PageBox | null;
  return found && found.width > 0 && found.height > 0 ? found : null;
}

async function exportPageOf(viewport: Viewport): Promise<ExportPage> {
  const page = await openPage(viewport);
  return {
    ...stillOf(page),
    freeze: async () => (await page.evaluate(`(${freezePage.toString()})(document)`)) as string,
    boxOf: (clipId) => boxOf(page, clipId),
    shot: async (mime, quality, clip) => Buffer.from(await page.screenshot({ type: SCREENSHOT_TYPE[mime], quality, omitBackground: true, ...(clip ? { clip: { x: clip.left, y: clip.top, width: clip.width, height: clip.height } } : {}) }))
  };
}

async function print(html: string): Promise<Buffer> {
  const page = await (await browser()).newPage();
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: LOAD_TIMEOUT_MS });
    await page.evaluate(() => document.fonts?.ready);
    return Buffer.from(await page.pdf({ preferCSSPageSize: true, printBackground: true }));
  } finally {
    await page.close();
  }
}

export const chromiumExport: ExportPort = { open: exportPageOf, print };

export const serverFramesOpen = () => Boolean(process.env.VERCEL || localChromium());

export const chromiumFrames: StillPort = { open: pageOf };

export const chromiumPage = async (): Promise<Page> => (await browser()).newPage();

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
