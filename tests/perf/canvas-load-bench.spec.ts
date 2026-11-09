import { spawn, type ChildProcess } from 'node:child_process';
import { copyFileSync, createReadStream, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { test, expect, chromium, type Browser, type BrowserContext, type CDPSession, type Page } from '@playwright/test';
import { LANDINGS_FIXTURE_CENTRE, LANDINGS_FIXTURE_PLACE } from '../../scripts/perf/landings-fixture.mjs';
import { localEnv } from '../../scripts/local.mjs';
import { mid } from '../../scripts/perf/bench-stats.mjs';

enum Cache {
  Cold = 'cold',
  Warm = 'warm'
}

type Build = { name: string; root: string; port: number };
type FrameLoad = { id: string; contentMs: number | null };
type LoadRun = { build: string; cache: Cache; frames: FrameLoad[]; firstMs: number | null; allContentMs: number | null; sharpMs: number; fixtureKept: boolean };
type Hotspot = { fn: string; url: string; selfMs: number };
type ProfileNode = { id: number; callFrame: { functionName: string; url: string; lineNumber: number; columnNumber: number } };
type Profile = { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] };

const RUNS = Number(process.env.BENCH_RUNS ?? 5);
const CPU_THROTTLE = Number(process.env.BENCH_CPU ?? 4);
const OUT = process.env.BENCH_OUT ?? 'perf-results';
const FIXTURE = process.env.BENCH_FIXTURE ?? join(homedir(), 'Documents/feega-videos/perf/landings/landings.feega');
const RECORD = process.env.BENCH_RECORD === '1';
const FIRST_PORT = 5291;
const VIEWPORT = { width: 1440, height: 900 };
const LOCAL_USER_ID = '00000000-0000-4000-8000-00000000f002';
const START_ZOOM = Number(process.env.BENCH_ZOOM ?? 0.12);
const START_VIEW = { x: VIEWPORT.width / 2 - LANDINGS_FIXTURE_CENTRE.x * START_ZOOM, y: VIEWPORT.height / 2 - LANDINGS_FIXTURE_CENTRE.y * START_ZOOM, zoom: START_ZOOM };
const VIEW_KEY = `feega:viewport:${LOCAL_USER_ID}:${LANDINGS_FIXTURE_PLACE.canvasId}`;
const CANVAS_PATH = `/p/${LANDINGS_FIXTURE_PLACE.projectId}/c/${LANDINGS_FIXTURE_PLACE.canvasId}`;
const POLL_MS = 50;
const STILL_MS = 1500;
const GIVE_UP_MS = 60_000;
const SERVER_UP_MS = 60_000;
const INK_MIN_PX = 24;
const INK_INSET = 0.15;
const US_PER_MS = 1000;
const CLEAR_OF_CHROME = { left: 100, top: 80, right: VIEWPORT.width - 100, bottom: VIEWPORT.height - 110 };
const HOTSPOTS = 25;

const builds = (): Build[] =>
  (process.env.BENCH_BUILDS ?? `this=${resolve('.')}`).split(',').map((pair, i) => {
    const [name, root] = pair.split('=');
    return { name, root: resolve(root), port: FIRST_PORT + i };
  });

const sha = (file: string) =>
  new Promise<string>((done, fail) => {
    const hash = createHash('sha256');
    createReadStream(file).on('data', (b) => hash.update(b)).on('end', () => done(hash.digest('hex'))).on('error', fail);
  });

async function serve(build: Build): Promise<{ server: ChildProcess; file: string }> {
  const file = join(mkdtempSync(join(tmpdir(), 'feega-load-')), 'served.feega');
  copyFileSync(FIXTURE, file);
  const server = spawn(process.execPath, [join(build.root, 'scripts/node-server.mjs')], { cwd: build.root, stdio: 'ignore', env: localEnv(file, String(build.port)) });
  const started = Date.now();
  while (Date.now() - started < SERVER_UP_MS) {
    if (await fetch(`http://127.0.0.1:${build.port}/favicon-16.png`).then((r) => r.ok).catch(() => false)) {
      return { server, file };
    }
    await new Promise((r) => setTimeout(r, POLL_MS * 4));
  }
  server.kill();
  throw new Error(`${build.name} server never came up`);
}

function hotspots(profile: Profile): Hotspot[] {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map<string, Hotspot>();
  profile.samples.forEach((id, i) => {
    const frame = byId.get(id)!.callFrame;
    const key = `${frame.functionName}@${frame.url}:${frame.lineNumber}:${frame.columnNumber}`;
    const spot = self.get(key) ?? { fn: frame.functionName || '(anonymous)', url: `${frame.url.split('/').pop()}:${frame.lineNumber}:${frame.columnNumber}`, selfMs: 0 };
    spot.selfMs += (profile.timeDeltas[i] ?? 0) / US_PER_MS;
    self.set(key, spot);
  });
  return [...self.values()].filter((s) => s.fn !== '(idle)' && s.fn !== '(program)').sort((a, b) => b.selfMs - a.selfMs).slice(0, HOTSPOTS).map((s) => ({ ...s, selfMs: Math.round(s.selfMs) }));
}

type Clip = { id: string; x: number; y: number; width: number; height: number };

async function frameClips(page: Page): Promise<Clip[]> {
  const boxes = await page.locator('[data-testid="gpu-node"]').evaluateAll((nodes) => nodes.map((n) => ({ id: (n as HTMLElement).dataset.id ?? '', r: n.getBoundingClientRect() })).map(({ id, r }) => ({ id, x: r.x, y: r.y, w: r.width, h: r.height })));
  return boxes.flatMap((b) => {
    const inner = { x: b.x + b.w * INK_INSET, y: b.y + b.h * INK_INSET, w: b.w * (1 - 2 * INK_INSET), h: b.h * (1 - 2 * INK_INSET) };
    const x = Math.max(CLEAR_OF_CHROME.left, Math.round(inner.x));
    const y = Math.max(CLEAR_OF_CHROME.top, Math.round(inner.y));
    const width = Math.min(CLEAR_OF_CHROME.right, Math.round(inner.x + inner.w)) - x;
    const height = Math.min(CLEAR_OF_CHROME.bottom, Math.round(inner.y + inner.h)) - y;
    return width > INK_MIN_PX && height > INK_MIN_PX ? [{ id: b.id, x, y, width, height }] : [];
  });
}

type Rgb = [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const NEAR = 24;
const INK_SHARE = 0.005;
const near = (data: Buffer, i: number, c: Rgb) => Math.abs(data[i] - c[0]) < NEAR && Math.abs(data[i + 1] - c[1]) < NEAR && Math.abs(data[i + 2] - c[2]) < NEAR;

async function canvasPaper(png: Buffer): Promise<Rgb> {
  const { data } = await sharp(png).resize(64, 64, { kernel: 'nearest' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const counts = new Map<string, number>();
  for (let i = 0; i < data.length; i += 3) {
    const key = `${data[i]},${data[i + 1]},${data[i + 2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number) as Rgb;
}

async function inked(png: Buffer, clip: Clip, scale: number, paper: Rgb): Promise<boolean> {
  const region = { left: Math.round(clip.x * scale), top: Math.round(clip.y * scale), width: Math.round(clip.width * scale), height: Math.round(clip.height * scale) };
  const { data } = await sharp(png).extract(region).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let ink = 0;
  for (let i = 0; i < data.length; i += 3) {
    ink += near(data, i, WHITE) || near(data, i, paper) ? 0 : 1;
  }
  return ink / (data.length / 3) >= INK_SHARE;
}

async function watchLoad(page: Page, from: number): Promise<Omit<LoadRun, 'build' | 'cache' | 'fixtureKept'>> {
  const content = new Map<string, number | null>();
  let last: Buffer | null = null;
  let changedAt = 0;
  while (Date.now() - from < GIVE_UP_MS) {
    const png = await page.screenshot({ clip: { x: 0, y: 0, ...VIEWPORT } }).catch(() => null);
    if (!png) {
      await page.waitForTimeout(POLL_MS);
      continue;
    }
    const at = Date.now() - from;
    const scale = (await sharp(png).metadata()).width! / VIEWPORT.width;
    const paper = await canvasPaper(png);
    for (const clip of await frameClips(page)) {
      if (content.get(clip.id) == null) {
        content.set(clip.id, (await inked(png, clip, scale, paper)) ? at : null);
        if (process.env.BENCH_DEBUG && content.get(clip.id) !== null) {
          writeFileSync(join(OUT, `debug-${at}-${clip.id.slice(0, 8)}.png`), await sharp(png).extract({ left: Math.round(clip.x * scale), top: Math.round(clip.y * scale), width: Math.round(clip.width * scale), height: Math.round(clip.height * scale) }).png().toBuffer());
          writeFileSync(join(OUT, `debug-${at}-full.png`), png);
        }
      }
    }
    if (!last || !png.equals(last)) {
      changedAt = at;
      last = png;
    }
    const allIn = content.size > 0 && [...content.values()].every((v) => v !== null);
    if (allIn && at - changedAt >= STILL_MS) {
      break;
    }
    await page.waitForTimeout(POLL_MS);
  }
  const frames = [...content.entries()].map(([id, contentMs]) => ({ id, contentMs }));
  const times = frames.map((f) => f.contentMs);
  const known = times.filter((t): t is number => t !== null);
  return { frames, firstMs: known.length ? Math.min(...known) : null, allContentMs: known.length === times.length && known.length ? Math.max(...known) : null, sharpMs: changedAt };
}

async function openOnce(context: BrowserContext, build: Build, profiled: boolean, video: string | null) {
  const page = await context.newPage();
  page.on('console', (m) => /core|frame/i.test(m.text()) && console.log(`  [page] ${m.text().slice(0, 240)}`));
  const cdp: CDPSession = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  if (profiled) {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
  }
  const from = Date.now();
  const requests: string[] = [];
  if (process.env.BENCH_DEBUG) {
    page.on('requestfinished', async (r) => {
      const size = (await r.sizes().catch(() => null))?.responseBodySize ?? -1;
      requests.push(`${Date.now() - from}\t${size}\t${r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 140)}`);
    });
  }
  await page.goto(`http://127.0.0.1:${build.port}${CANVAS_PATH}`, { waitUntil: 'commit' });
  const load = await watchLoad(page, from);
  if (requests.length) {
    writeFileSync(join(OUT, `requests-${build.name}-${Date.now()}.tsv`), requests.join('\n'));
  }
  const spots = profiled ? hotspots((await cdp.send('Profiler.stop')).profile as Profile) : [];
  if (video) {
    writeFileSync(join(OUT, `${video}-end.png`), await page.screenshot());
  }
  await page.close();
  return { load, spots };
}

async function runOnce(browser: Browser, build: Build, cache: Cache, profiled: boolean): Promise<{ run: LoadRun; spots: Hotspot[] }> {
  const { server, file } = await serve(build);
  const before = await sha(file);
  const recordDir = RECORD ? join(OUT, `video-${build.name}-${cache}`) : null;
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block', ...(recordDir ? { recordVideo: { dir: recordDir, size: VIEWPORT } } : {}) });
  if (process.env.BENCH_ZOOM) {
    await context.addInitScript(({ key, view }) => localStorage.setItem(key, JSON.stringify(view)), { key: VIEW_KEY, view: START_VIEW });
  }
  try {
    if (cache === Cache.Warm) {
      await openOnce(context, build, false, null);
    }
    const { load, spots } = await openOnce(context, build, profiled, recordDir ? `${build.name}-${cache}` : null);
    const after = await sha(file);
    return { run: { build: build.name, cache, ...load, fixtureKept: before === after }, spots };
  } finally {
    await context.close();
    server.kill();
  }
}

const range = (values: number[]) => ({ median: Math.round(mid(values)), min: Math.min(...values), max: Math.max(...values) });

function summary(runs: LoadRun[]) {
  const groups = new Map<string, LoadRun[]>();
  for (const r of runs) {
    groups.set(`${r.build}/${r.cache}`, [...(groups.get(`${r.build}/${r.cache}`) ?? []), r]);
  }
  return Object.fromEntries(
    [...groups.entries()].map(([key, rs]) => {
      const pick = (f: (r: LoadRun) => number | null) => {
        const values = rs.map(f).filter((v): v is number => v !== null);
        return values.length === rs.length ? range(values) : { missing: rs.length - values.length, ...(values.length ? range(values) : {}) };
      };
      return [key, { runs: rs.length, firstContentMs: pick((r) => r.firstMs), allContentMs: pick((r) => r.allContentMs), sharpMs: pick((r) => r.sharpMs), frameContentMs: pick((r) => (r.frames.length ? mid(r.frames.map((f) => f.contentMs ?? GIVE_UP_MS)) : null)) }];
    })
  );
}

test('load benchmark: on-screen frames show content, then turn sharp', async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] });
  const runs: LoadRun[] = [];
  const spots: Record<string, Hotspot[]> = {};
  for (let i = 0; i < RUNS; i++) {
    for (const cache of Object.values(Cache)) {
      for (const build of builds()) {
        const key = `${build.name}/${cache}`;
        const done = await runOnce(browser, build, cache, i === 0);
        runs.push(done.run);
        spots[key] ??= done.spots;
        console.log(`run ${i + 1}/${RUNS} ${key} ${JSON.stringify({ first: done.run.firstMs, all: done.run.allContentMs, sharp: done.run.sharpMs, frames: done.run.frames.length, kept: done.run.fixtureKept })}`);
      }
    }
  }
  await browser.close();
  const result = { cpuThrottle: CPU_THROTTLE, zoom: START_ZOOM, runs, summary: summary(runs), hotspots: spots };
  writeFileSync(join(OUT, `load-bench-${CPU_THROTTLE}x.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result.summary, null, 2));
  expect(runs.every((r) => r.fixtureKept)).toBe(true);
  expect(runs.every((r) => r.frames.length > 0)).toBe(true);
});
