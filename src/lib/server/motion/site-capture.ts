import { assertPublicUrl } from '$lib/server/tool-guard';
import { FARM_JOB_DIR, FARM_RUNTIME_DIR, type FarmWorker, type RenderFarm } from './render-farm';
import { CaptureView, type CaptureShot, type SiteCapture } from './motion-tools';

export const CAPTURE_SCALE = 2;
export const MAX_SECTIONS = 4;

export const VIEWPORTS: Record<CaptureView, { width: number; height: number; mobile: boolean }> = {
  [CaptureView.Desktop]: { width: 1440, height: 900, mobile: false },
  [CaptureView.Mobile]: { width: 390, height: 844, mobile: true }
};

const CAPTURE_DIR = `${FARM_JOB_DIR}/capture`;
const SCRIPT = `${FARM_RUNTIME_DIR}/capture.cjs`;
const MANIFEST = `${CAPTURE_DIR}/manifest.json`;
const WORKER = { allowHosts: ['*'], timeoutMs: 3 * 60_000, vcpus: 2 };
const OUTPUT_TAIL = 400;

export type Shot = { part: string; bytes: Buffer };
export type StoreShot = (shot: Shot, page: { url: string; label: string }) => Promise<CaptureShot | { error: string }>;

type Page = {
  setViewport: (v: Record<string, unknown>) => Promise<void>;
  goto: (url: string, o: Record<string, unknown>) => Promise<unknown>;
  evaluate: <T, A>(fn: (arg: A) => T, arg?: A) => Promise<T>;
  screenshot: (o: { path: string }) => Promise<unknown>;
};
type Browser = { newPage: () => Promise<Page>; close: () => Promise<void> };
type Puppeteer = { launch: (o: Record<string, unknown>) => Promise<Browser> };
type Files = { writeFileSync: (path: string, data: string) => void };
type Viewport = { width: number; height: number; mobile: boolean };

function captureRuntime(puppeteer: Puppeteer, fs: Files, url: string, view: Viewport, scale: number, sections: number, dir: string) {
  const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  return (async () => {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--hide-scrollbars'] });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: view.width, height: view.height, deviceScaleFactor: scale, isMobile: view.mobile, hasTouch: view.mobile });
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 45000 });
      await settle(1500);
      const height = await page.evaluate(() => document.documentElement.scrollHeight, undefined);
      const stops = [0];
      for (let i = 1; i <= sections && i * view.height < height - view.height / 2; i++) {
        stops.push(i * view.height);
      }
      const shots = [];
      for (const [i, top] of stops.entries()) {
        await page.evaluate((y: number) => window.scrollTo(0, y), top);
        await settle(700);
        const file = `${dir}/shot-${i}.png`;
        await page.screenshot({ path: file });
        shots.push({ part: i ? `section ${i + 1}` : 'top', file });
      }
      fs.writeFileSync(`${dir}/manifest.json`, JSON.stringify(shots));
    } finally {
      await browser.close();
    }
  })();
}

export function captureProgram(url: string, view: CaptureView): string {
  return `(${captureRuntime.toString()})(require('puppeteer'), require('node:fs'), ${JSON.stringify(url)}, ${JSON.stringify(VIEWPORTS[view])}, ${CAPTURE_SCALE}, ${MAX_SECTIONS}, ${JSON.stringify(CAPTURE_DIR)}).catch((e) => { console.error(String(e && e.stack || e)); process.exit(1); });`;
}

async function shotsOf(worker: FarmWorker, url: string, view: CaptureView): Promise<Shot[] | string> {
  await worker.run('mkdir', ['-p', CAPTURE_DIR]);
  await worker.write([{ path: SCRIPT, content: Buffer.from(captureProgram(url, view)) }]);
  const done = await worker.run('bash', ['-lc', `cd ${FARM_RUNTIME_DIR} && node ${SCRIPT}`]);
  if (done.exitCode !== 0) {
    return `the page could not be captured: ${done.output.slice(-OUTPUT_TAIL)}`;
  }
  const manifest = await worker.read(MANIFEST);
  const listed: { part: string; file: string }[] = manifest ? JSON.parse(manifest.toString()) : [];
  const shots = await Promise.all(listed.map(async (s) => ({ part: s.part, bytes: await worker.read(s.file) })));
  return shots.flatMap((s) => (s.bytes ? [{ part: s.part, bytes: s.bytes }] : []));
}

export function farmCapture(farm: RenderFarm, store: StoreShot) {
  return async (url: string, view: CaptureView): Promise<SiteCapture> => {
    const reachable = await assertPublicUrl(new URL(url), 'https-only').then(() => true, () => false);
    if (!reachable) {
      return { ok: false, error: 'capture takes a public https page' };
    }
    const worker = await farm.open(WORKER);
    try {
      const shots = await shotsOf(worker, url, view);
      if (typeof shots === 'string') {
        return { ok: false, error: shots };
      }
      const host = new URL(url).hostname;
      const stored = await Promise.all(shots.map((s) => store(s, { url, label: `${view} ${s.part} · ${host}` })));
      const kept = stored.filter((s): s is CaptureShot => !('error' in s));
      return kept.length ? { ok: true, shots: kept } : { ok: false, error: 'the page gave no screenshot' };
    } finally {
      await worker.stop();
    }
  };
}
