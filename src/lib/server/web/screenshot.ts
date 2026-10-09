import type { HTTPRequest, Page } from 'puppeteer-core';
import { assertPublicUrl } from '$lib/server/tool-guard';

export enum ShotView {
  Desktop = 'desktop',
  Mobile = 'mobile'
}

export enum RequestVerdict {
  Continue = 'continue',
  Abort = 'abort'
}

export type Shot = { ok: true; jpeg: Buffer; width: number; height: number } | { ok: false; error: string };

export type OpenPage = () => Promise<Page>;

const VIEWPORTS: Record<ShotView, { width: number; height: number; isMobile: boolean }> = {
  [ShotView.Desktop]: { width: 1280, height: 800, isMobile: false },
  [ShotView.Mobile]: { width: 390, height: 844, isMobile: true }
};
const LOAD_TIMEOUT_MS = 20_000;
const SETTLE_MS = 800;
const JPEG_QUALITY = 70;
const INERT_SCHEMES = ['data:', 'blob:', 'about:'];
const WEB_SCHEMES = ['http:', 'https:'];

export async function requestVerdict(url: string): Promise<RequestVerdict> {
  const parsed = URL.canParse(url) ? new URL(url) : null;
  if (!parsed) {
    return RequestVerdict.Abort;
  }
  if (INERT_SCHEMES.includes(parsed.protocol)) {
    return RequestVerdict.Continue;
  }
  if (!WEB_SCHEMES.includes(parsed.protocol)) {
    return RequestVerdict.Abort;
  }
  return assertPublicUrl(parsed).then(
    () => RequestVerdict.Continue,
    () => RequestVerdict.Abort
  );
}

async function gate(request: HTTPRequest): Promise<void> {
  const verdict = await requestVerdict(request.url());
  await (verdict === RequestVerdict.Continue ? request.continue() : request.abort('blockedbyclient')).catch(() => undefined);
}

export async function screenshotPage(url: string, view: ShotView, open: OpenPage): Promise<Shot> {
  if ((await requestVerdict(url)) === RequestVerdict.Abort) {
    return { ok: false, error: 'that address is not a public web page' };
  }
  const viewport = VIEWPORTS[view];
  const page = await open();
  try {
    await page.setViewport({ width: viewport.width, height: viewport.height, isMobile: viewport.isMobile, deviceScaleFactor: 1 });
    await page.setRequestInterception(true);
    page.on('request', (request) => void gate(request));
    await page.goto(url, { waitUntil: 'networkidle2', timeout: LOAD_TIMEOUT_MS });
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    const jpeg = Buffer.from(await page.screenshot({ type: 'jpeg', quality: JPEG_QUALITY }));
    return { ok: true, jpeg, width: viewport.width, height: viewport.height };
  } catch (e) {
    return { ok: false, error: `could not photograph ${url}: ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    await page.close().catch(() => undefined);
  }
}
