import { existsSync } from 'node:fs';
import type { Browser, Page } from 'puppeteer-core';
import shaderRuntime from 'virtual:motion-shader-fx';
import type { ExportPage, ExportPort, PageBox, StillPage, StillPort, Viewport } from './server-frames';
import { Pose, kindsOf, measureClips } from '@feega/motion-core/motion/hyperframes/measure';
import type { GlPage } from '$lib/server/effects/check';
import { extraChromiumArgs } from './chromium-args';

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
    return puppeteer.launch({ executablePath: local, args: extraChromiumArgs(process.env), headless: 'shell' });
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
const BAND_PX = 2048;
const STAGE_ID = 'root';

async function shiftedTo(page: Page, top: number) {
  await page.evaluate(
    async (id, y) => {
      const stage = document.getElementById(id);
      if (stage) {
        stage.style.translate = `0 ${-y}px`;
      }
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    },
    STAGE_ID,
    top
  );
}

const wholeOf = (full: Viewport): PageBox => ({ left: 0, top: 0, width: full.width, height: full.height });

async function pictureOf(page: Page, full: Viewport, mime: string, quality?: number, region: PageBox = wholeOf(full)): Promise<Buffer> {
  const type = SCREENSHOT_TYPE[mime];
  const bands: { input: Buffer; top: number; left: number }[] = [];
  for (let top = 0; top < region.height; top += BAND_PX) {
    await shiftedTo(page, region.top + top);
    const clip = { x: region.left, y: 0, width: region.width, height: Math.min(BAND_PX, region.height - top) };
    bands.push({ input: Buffer.from(await page.screenshot({ type: 'png', omitBackground: true, clip })), top: Math.round(top * full.scale), left: 0 });
  }
  await shiftedTo(page, 0);
  const { default: sharp } = await import('sharp');
  const size = { width: Math.round(region.width * full.scale), height: Math.round(region.height * full.scale) };
  if (bands.length === 1 && type === 'png') {
    return bands[0].input;
  }
  const sheet = sharp({ create: { ...size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } }, limitInputPixels: false }).composite(bands);
  return sheet.toFormat(type, quality === undefined ? {} : { quality }).toBuffer();
}

async function openPage(viewport: Viewport): Promise<Page> {
  const page = await (await browser()).newPage();
  page.setDefaultTimeout(SEEK_TIMEOUT_MS);
  await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.scale });
  return page;
}

function stillOf(page: Page, full: Viewport): StillPage {
  return {
    load: (html) => load(page, html),
    seek: (seconds) => seek(page, seconds),
    jpeg: async (quality) => Buffer.from(await page.screenshot({ type: 'jpeg', quality })),
    picture: (mime, quality) => pictureOf(page, full, mime, quality),
    close: () => page.close()
  };
}

const banded = (viewport: Viewport): Viewport => ({ ...viewport, height: Math.min(viewport.height, BAND_PX) });

const pageOf = async (viewport: Viewport): Promise<StillPage> => stillOf(await openPage(banded(viewport)), viewport);

async function boxOf(page: Page, clipId: string): Promise<PageBox | null> {
  const found = (await page.evaluate(`(function(){var root=document.getElementById('root');if(!root){return null;}var r=root.getBoundingClientRect();var b=(${measureClips.toString()})(root,${JSON.stringify(kindsOf(Pose.Base))})[${JSON.stringify(clipId)}];return b?{left:b.left*r.width,top:b.top*r.height,width:b.width*r.width,height:b.height*r.height}:null;})()`)) as PageBox | null;
  return found && found.width > 0 && found.height > 0 ? found : null;
}

async function exportPageOf(viewport: Viewport): Promise<ExportPage> {
  const page = await openPage(banded(viewport));
  return {
    ...stillOf(page, viewport),
    boxOf: (clipId) => boxOf(page, clipId),
    shot: (mime, quality, clip) => pictureOf(page, viewport, mime, quality, clip ?? wholeOf(viewport))
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
