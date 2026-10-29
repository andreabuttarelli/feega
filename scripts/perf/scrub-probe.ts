import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, type CDPSession, type Page } from '@playwright/test';

const BASE = process.env.PERF_BASE ?? 'http://localhost:5193';
const OUT = new URL('./out/', import.meta.url).pathname;
const FIXTURE = JSON.parse(readFileSync(`${OUT}scrub-fixture.json`, 'utf8')) as { projectId: string; canvasId: string; nodeId: string };
const VIEWPORT = { width: 1600, height: 1000 };
const THROTTLES = (process.env.PERF_THROTTLES ?? '1,4').split(',').map(Number);
const RUNS = Number(process.env.PERF_RUNS ?? 3);
const SCRUB_MS = 2000;
const QUIET_MS = 3000;
const TRACE = process.env.PERF_TRACE === '1';
const LABEL = process.env.PERF_LABEL ?? 'run';
const TRACE_CATEGORIES = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'v8', 'v8.execute', 'disabled-by-default-v8.cpu_profiler', 'blink.user_timing'];
const TSX_NAME_SHIM = 'window.__name = (f) => f;';

type Req = { at: number; method: string; url: string };

enum Kind {
  Save = 'save',
  Source = 'source',
  History = 'history',
  Rest = 'rest',
  Other = 'other'
}

const KIND_RULES: [Kind, (r: Req) => boolean][] = [
  [Kind.Save, (r) => r.method === 'POST' && /\/motion\/[^/?]+(\?|$)/.test(r.url)],
  [Kind.Source, (r) => /\/source/.test(r.url)],
  [Kind.History, (r) => /history|revisions|canvas_events|conflicts/.test(r.url)],
  [Kind.Rest, (r) => /\/rest\/v1\//.test(r.url)]
];

const kindOf = (r: Req) => KIND_RULES.find(([, test]) => test(r))?.[0] ?? Kind.Other;

function probe() {
  const w = window as unknown as { __scrub: { gaps: number[]; longs: number[]; on: boolean; last: number } };
  w.__scrub = { gaps: [], longs: [], on: false, last: 0 };
  const tick = (now: number) => {
    const s = w.__scrub;
    if (s.on && s.last) {
      s.gaps.push(now - s.last);
    }
    s.last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (w.__scrub.on) {
        w.__scrub.longs.push(e.duration);
      }
    }
  }).observe({ type: 'longtask', buffered: false });
}

async function login(page: Page) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' });
}

async function openLayer(page: Page) {
  await page.goto(`${BASE}/p/${FIXTURE.projectId}/c/${FIXTURE.canvasId}`);
  await page.waitForTimeout(8000);
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const surface = page.locator('canvas').first();
  const box = await surface.boundingBox();
  if (!box) {
    throw new Error('no canvas surface');
  }
  await page.keyboard.press('Shift+1');
  await page.waitForTimeout(1500);
  const at = { x: box.x + box.width * Number(process.env.PERF_PICK_X ?? 0.5), y: box.y + box.height * Number(process.env.PERF_PICK_Y ?? 0.69) };
  for (let i = 0; i < Number(process.env.PERF_CLICKS ?? 2); i++) {
    await page.mouse.click(at.x, at.y);
    await page.waitForTimeout(700);
  }
  await page.getByRole('tab', { name: 'Properties' }).or(page.getByRole('button', { name: 'Properties' })).first().click().catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}${LABEL}-picked.png` });
}

type Sample = { releaseMs: number; fps: number; p95: number; maxGap: number; longs: number; longMs: number; reqs: Record<Kind, number>; reqsAfter: Record<Kind, number>; ticks: number };

function count(reqs: Req[], from: number, to: number): Record<Kind, number> {
  const out = { [Kind.Save]: 0, [Kind.Source]: 0, [Kind.History]: 0, [Kind.Rest]: 0, [Kind.Other]: 0 };
  for (const r of reqs.filter((x) => x.at >= from && x.at < to)) {
    out[kindOf(r)] += 1;
  }
  return out;
}

let scenarioWave = (t: number) => (1 - Math.cos(t)) / 2;

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<number> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const start = Date.now();
  let ticks = 0;
  while (Date.now() - start < SCRUB_MS) {
    const t = ((Date.now() - start) / SCRUB_MS) * Math.PI * 2;
    const k = scenarioWave(t);
    await page.mouse.move(from.x + (to.x - from.x) * k, from.y + (to.y - from.y) * k + Math.sin(t * 3) * 6);
    ticks += 1;
  }
  return ticks;
}

enum Scenario {
  Opacity = 'opacity',
  Colour = 'colour'
}

async function target(page: Page, scenario: Scenario) {
  if (scenario === Scenario.Opacity) {
    const field = page.locator('[data-testid="opacity-field"] input').first();
    await field.waitFor({ timeout: 10_000 });
    await field.fill('50');
    await field.press('Enter');
    await page.waitForTimeout(QUIET_MS);
    scenarioWave = (t) => Math.sin(t);
    const b = (await field.boundingBox())!;
    return { from: { x: b.x + b.width / 2, y: b.y + b.height / 2 }, to: { x: b.x + b.width / 2 + 150, y: b.y + b.height / 2 } };
  }
  scenarioWave = (t) => (1 - Math.cos(t)) / 2;
  const square = page.locator('[data-testid="colour-square"]').first();
  if (!(await square.isVisible().catch(() => false))) {
    await page.locator(process.env.PERF_SWATCH ?? '[data-testid="fill-swatch"], .swatch').first().click();
  }
  await square.waitFor({ timeout: 10_000 });
  const b = (await square.boundingBox())!;
  return { from: { x: b.x + b.width * 0.1, y: b.y + b.height * 0.1 }, to: { x: b.x + b.width * 0.9, y: b.y + b.height * 0.9 } };
}

async function run(page: Page, cdp: CDPSession, reqs: Req[], scenario: Scenario, throttle: number, i: number): Promise<Sample> {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur?.());
  const { from, to } = await target(page, scenario);
  await page.waitForTimeout(1000);
  if (TRACE && i === 0) {
    await cdp.send('Tracing.start', { categories: TRACE_CATEGORIES.join(','), transferMode: 'ReturnAsStream' });
  }
  await page.evaluate(() => {
    const s = (window as unknown as { __scrub: { gaps: number[]; longs: number[]; on: boolean; last: number } }).__scrub;
    s.gaps = [];
    s.longs = [];
    s.last = 0;
    s.on = true;
  });
  const valueOf = () => page.locator('[data-testid="opacity-field"] input').first().inputValue().catch(() => '?');
  const before = scenario === Scenario.Opacity ? await valueOf() : '';
  const t0 = Date.now();
  const ticks = await drag(page, from, to);
  const released = Date.now();
  await page.mouse.up();
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const releaseMs = Date.now() - released;
  if (process.env.PERF_VERBOSE === '1') {
    console.log('  value', before, '->', scenario === Scenario.Opacity ? await valueOf() : '', JSON.stringify(from));
    await page.screenshot({ path: `${OUT}${LABEL}-${scenario}-${i}.png` });
  }
  const t1 = Date.now();
  const got = await page.evaluate(() => {
    const s = (window as unknown as { __scrub: { gaps: number[]; longs: number[]; on: boolean } }).__scrub;
    s.on = false;
    return { gaps: s.gaps, longs: s.longs };
  });
  if (TRACE && i === 0) {
    await saveTrace(cdp, `${OUT}${LABEL}-${scenario}-x${throttle}.json`);
  }
  await page.waitForTimeout(QUIET_MS);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const total = got.gaps.reduce((a, b) => a + b, 0);
  const sorted = [...got.gaps].sort((a, b) => a - b);
  return {
    releaseMs,
    fps: total ? Math.round((got.gaps.length / total) * 1000 * 10) / 10 : 0,
    p95: Math.round(sorted[Math.floor(sorted.length * 0.95)] ?? 0),
    maxGap: Math.round(sorted[sorted.length - 1] ?? 0),
    longs: got.longs.length,
    longMs: Math.round(got.longs.reduce((a, b) => a + b, 0)),
    reqs: count(reqs, t0, t1),
    reqsAfter: count(reqs, t1, t1 + QUIET_MS),
    ticks
  };
}

async function saveTrace(cdp: CDPSession, path: string) {
  const done = new Promise<string>((resolve) => cdp.once('Tracing.tracingComplete', (e) => resolve(e.stream as string)));
  await cdp.send('Tracing.end');
  const stream = await done;
  let data = '';
  for (;;) {
    const chunk = await cdp.send('IO.read', { handle: stream });
    data += chunk.data;
    if (chunk.eof) {
      break;
    }
  }
  await cdp.send('IO.close', { handle: stream });
  writeFileSync(path, data);
}

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: process.env.PERF_HEADLESS === '1', args: ['--enable-unsafe-webgpu'] });
const STATE = `${OUT}state.json`;
const context = await browser.newContext({ viewport: VIEWPORT, storageState: existsSync(STATE) ? STATE : undefined });
await context.addInitScript(TSX_NAME_SHIM);
await context.addInitScript(probe);
const page = await context.newPage();
const reqs: Req[] = [];
page.on('request', (r) => reqs.push({ at: Date.now(), method: r.method(), url: r.url() }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
if (!existsSync(STATE)) {
  await login(page);
  await context.storageState({ path: STATE });
}
await openLayer(page);
const cdp = await context.newCDPSession(page);
const scenarios = (process.env.PERF_SCENARIOS ?? 'opacity,colour').split(',') as Scenario[];
const rows: Record<string, unknown>[] = [];
for (const scenario of scenarios) {
  for (const throttle of THROTTLES) {
    const samples: Sample[] = [];
    for (let i = 0; i < RUNS; i++) {
      samples.push(await run(page, cdp, reqs, scenario, throttle, i));
      if (process.env.PERF_VERBOSE === '1') {
        console.log('  sample', JSON.stringify(samples.at(-1)));
      }
    }
    const row = {
      scenario,
      throttle,
      fps: median(samples.map((s) => s.fps)),
      releaseMs: median(samples.map((s) => s.releaseMs)),
      p95Ms: median(samples.map((s) => s.p95)),
      maxGapMs: median(samples.map((s) => s.maxGap)),
      longTasks: median(samples.map((s) => s.longs)),
      longTaskMs: median(samples.map((s) => s.longMs)),
      savesDuring: median(samples.map((s) => s.reqs[Kind.Save])),
      savesAfter: median(samples.map((s) => s.reqsAfter[Kind.Save])),
      sourceDuring: median(samples.map((s) => s.reqs[Kind.Source])),
      historyDuring: median(samples.map((s) => s.reqs[Kind.History])),
      historyAfter: median(samples.map((s) => s.reqsAfter[Kind.History])),
      restDuring: median(samples.map((s) => s.reqs[Kind.Rest])),
      otherDuring: median(samples.map((s) => s.reqs[Kind.Other])),
      ticks: median(samples.map((s) => s.ticks))
    };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
}
writeFileSync(`${OUT}${LABEL}-results.json`, JSON.stringify({ rows, urls: reqs.filter((r) => kindOf(r) !== Kind.Other || /api|motion|canvas/.test(r.url)).slice(-300) }, null, 2));
await browser.close();
