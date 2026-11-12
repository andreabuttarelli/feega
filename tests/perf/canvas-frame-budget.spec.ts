import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { join } from 'node:path';
import { loadavg } from 'node:os';
import { test, expect, chromium, type Browser, type CDPSession, type Page } from '@playwright/test';
import { instrument, wheelPan } from '../e2e/fixtures/frame-sweeps';
import { LANDINGS_FIXTURE_PLACE } from '../../scripts/perf/landings-fixture.mjs';
import { budgetOf, editBudgetOf, EDIT_BUDGET_MS, FRAME_BUDGET_MS, Rate } from '../../scripts/perf/frame-budget';

enum Gesture {
  Pan = 'pan',
  Zoom = 'zoom',
  Fit = 'fit',
  Drag = 'drag',
  DragElement = 'drag-element'
}

enum Edit {
  Nudge = 'nudge',
  Resize = 'resize',
  Opacity = 'opacity',
  Hide = 'hide',
  Text = 'text'
}

enum Target {
  Landings = 'landings',
  Heavy = 'heavy'
}

type Place = { projectId: string; canvasId: string };
type Box = { x: number; y: number; w: number; h: number };

const HEAVY_PLACE: Place = { projectId: '9af789a4-da22-4231-bf6c-68bcb10b0377', canvasId: 'bf55d313-9155-4de3-a5ef-c3c0259e98e2' };
const MS_PER_S = 1000;
const RUNS = Number(process.env.BUDGET_RUNS ?? 3);
const OUT = process.env.BUDGET_OUT ?? 'perf-results';
const LANDINGS_BASE = process.env.BUDGET_LANDINGS_BASE ?? `http://127.0.0.1:${process.env.BENCH_PORT ?? 5288}`;
const HEAVY_BASE = process.env.BUDGET_HEAVY_BASE ?? `http://127.0.0.1:${Number(process.env.BENCH_PORT ?? 5288) + 1}`;
const GESTURES_RUN = (process.env.BUDGET_GESTURES?.split(',') ?? null) as string[] | null;
const benched = () => Object.values(Gesture).filter((g) => !GESTURES_RUN || GESTURES_RUN.includes(g));
const TARGETS = (process.env.BUDGET_TARGETS?.split(',') ?? Object.values(Target)) as Target[];
const VIEWPORT = { width: 1440, height: 900 };
const SETTLE_MS = 10_000;
const GESTURE_MS = 4000;
const FIT_TOGGLE_MS = 700;
const ZOOM_WHEEL_PX = 60;
const ZOOM_STEPS_EACH_WAY = 8;
const DRAG_SWING = { x: 200, y: 150 };
const LABEL_ABOVE_PX = 14;
const LABEL_IN_PX = 8;
const SCREEN_MARGIN_PX = 100;
const TOP_CHROME_PX = 80;
const DRAG_FRAME_PX = 300;
const DRAG_ZOOM_STEPS = 40;
const DRAG_ZOOM_WHEEL_PX = 100;
const DRAG_ZOOM_PAUSE_MS = 60;
const DRAG_SETTLE_MS = 1500;
const PROFILED = process.env.BUDGET_PROFILE === '1';
const PROFILE_SAMPLE_US = 100;
const EDIT_KINDS = process.env.BUDGET_EDIT_KINDS?.split(',') ?? null;
const SHOTS = process.env.BUDGET_SHOTS === '1';
const SHOT_SETTLE_MS = 1500;
const PIXEL_TOLERANCE = 8;
const PERCENT = 100;
const UNCAPPED = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'];

const PLACES: Record<Target, { base: string; place: Place; login: boolean }> = {
  [Target.Landings]: { base: LANDINGS_BASE, place: LANDINGS_FIXTURE_PLACE, login: false },
  [Target.Heavy]: { base: HEAVY_BASE, place: HEAVY_PLACE, login: true }
};

async function login(page: Page, base: string) {
  await page.goto(`${base}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

type Tile = Box & { id: string; at: string };

async function tiles(page: Page): Promise<Tile[]> {
  return page.locator('[data-testid="gpu-node"]').evaluateAll((nodes) =>
    nodes.map((n) => {
      const r = n.getBoundingClientRect();
      const el = n as HTMLElement;
      return { id: el.dataset.id ?? '', at: el.dataset.box ?? '', x: r.x, y: r.y, w: r.width, h: r.height };
    })
  );
}

const labelAt = (b: Box) => ({ x: b.x + LABEL_IN_PX, y: b.y - LABEL_ABOVE_PX });

const reachable = (b: Box) => {
  const at = labelAt(b);
  return at.x > SCREEN_MARGIN_PX && at.x < VIEWPORT.width - SCREEN_MARGIN_PX && at.y > TOP_CHROME_PX && at.y < VIEWPORT.height - SCREEN_MARGIN_PX;
};

async function frameOnScreen(page: Page): Promise<Tile> {
  const onScreen = (await tiles(page)).filter(reachable).sort((a, b) => b.w * b.h - a.w * a.h);
  if (!onScreen.length) {
    throw new Error('drag: no frame on screen to grab');
  }
  return onScreen[0];
}

async function zoomOntoFrame(page: Page): Promise<string> {
  const { id } = await frameOnScreen(page);
  const tile = page.locator(`[data-testid="gpu-node"][data-id="${id}"]`);
  await page.keyboard.down('Control');
  for (let i = 0; i < DRAG_ZOOM_STEPS; i++) {
    const box = (await tile.boundingBox())!;
    if (box.width >= DRAG_FRAME_PX) {
      break;
    }
    const at = labelAt({ x: box.x, y: box.y, w: box.width, h: box.height });
    await page.mouse.move(at.x, at.y);
    await page.mouse.wheel(0, -DRAG_ZOOM_WHEEL_PX);
    await page.waitForTimeout(DRAG_ZOOM_PAUSE_MS);
  }
  await page.keyboard.up('Control');
  await page.waitForTimeout(DRAG_SETTLE_MS);
  return id;
}

async function placeOf(page: Page, id: string): Promise<string> {
  return (await tiles(page)).find((t) => t.id === id)?.at ?? '';
}

const FRAME_WAIT_MS = 50;

const nextFrame = (page: Page) => page.evaluate((most) => new Promise((done) => { requestAnimationFrame(done); setTimeout(done, most); }), FRAME_WAIT_MS);

async function zoom(page: Page, until: number) {
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await page.keyboard.down('Control');
  for (let i = 0; Date.now() < until; i++) {
    await page.mouse.wheel(0, Math.floor(i / ZOOM_STEPS_EACH_WAY) % 2 ? ZOOM_WHEEL_PX : -ZOOM_WHEEL_PX);
    await nextFrame(page);
  }
  await page.keyboard.up('Control');
}

async function fit(page: Page, until: number) {
  for (let i = 0; Date.now() < until; i++) {
    await page.keyboard.press(i % 2 ? 'Shift+Digit0' : 'Shift+Digit1');
    await page.waitForTimeout(FIT_TOGGLE_MS);
  }
}

async function swing(page: Page, from: { x: number; y: number }, until: number): Promise<number> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  let moves = 0;
  for (; Date.now() < until; moves++) {
    const t = moves / 10;
    await page.mouse.move(from.x + Math.sin(t) * DRAG_SWING.x, from.y + Math.sin(t * 0.7) * DRAG_SWING.y);
    await nextFrame(page);
  }
  return moves;
}

async function release(page: Page, from: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.up();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
}

async function drag(page: Page, until: number, aim?: string) {
  const box = (await tiles(page)).find((t) => t.id === aim) ?? (await frameOnScreen(page));
  const from = labelAt(box);
  const moves = await swing(page, from, until);
  const moved = (await placeOf(page, box.id)) !== box.at;
  console.log(`drag: ${moves} moves on ${box.id}`);
  await release(page, from);
  if (!moved) {
    throw new Error(`drag: frame ${box.id} did not move`);
  }
  return moves;
}

const CONTAINER_TRIES = 12;
const CONTAINER_STEP = 0.06;

async function selectContainer(page: Page): Promise<string> {
  const id = await zoomOntoFrame(page);
  const strips = page.getByTestId('auto-layout-overlay');
  for (let i = 0; i < CONTAINER_TRIES; i++) {
    const box = (await tiles(page)).find((t) => t.id === id)!;
    await page.mouse.click(box.x + box.w * 0.5, box.y + box.w * (CONTAINER_STEP * (i + 1)));
    if (await strips.first().isVisible()) {
      return id;
    }
    await page.keyboard.press('Escape');
  }
  throw new Error('drag-element: no auto-layout container to select');
}

async function dragElement(page: Page, until: number) {
  const body = page.getByTestId('frame-selection-body').first();
  const box = (await body.boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 20) };
  const moves = await swing(page, from, until);
  const after = (await body.boundingBox())!;
  console.log(`drag-element: ${moves} moves`);
  await release(page, from);
  if (after.x === box.x && after.y === box.y) {
    throw new Error('drag-element: the element did not move');
  }
  return moves;
}

const GESTURES: Record<Gesture, (page: Page, until: number, aim?: string) => Promise<number | void>> = {
  [Gesture.Pan]: wheelPan,
  [Gesture.Zoom]: zoom,
  [Gesture.Fit]: fit,
  [Gesture.Drag]: drag,
  [Gesture.DragElement]: dragElement
};

type Seen = { gaps: number[]; taskMs: number; moves: number };

async function taskSeconds(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find((m) => m.name === 'TaskDuration')?.value ?? 0;
}

const SETUP: Partial<Record<Gesture, (page: Page) => Promise<string>>> = {
  [Gesture.Drag]: zoomOntoFrame,
  [Gesture.DragElement]: selectContainer
};

async function gaps(page: Page, cdp: CDPSession, gesture: Gesture): Promise<Seen> {
  const aim = await SETUP[gesture]?.(page);
  await page.evaluate(() => Object.assign((window as unknown as { __frames: object }).__frames, { gaps: [], work: [], counting: true }));
  const prof = PROFILED ? cdp : null;
  if (prof) {
    await prof.send('Profiler.enable');
    await prof.send('Profiler.setSamplingInterval', { interval: PROFILE_SAMPLE_US });
    await prof.send('Profiler.start');
  }
  const before = await taskSeconds(cdp);
  const moves = (await GESTURES[gesture](page, Date.now() + GESTURE_MS, aim)) ?? 0;
  const after = await taskSeconds(cdp);
  if (prof) {
    const { profile } = await prof.send('Profiler.stop');
    writeFileSync(join(OUT, `gesture-${gesture}.cpuprofile`), JSON.stringify(profile));
  }
  const seen = await page.evaluate(() => {
    const probe = (window as unknown as { __frames: { gaps: number[]; counting: boolean } }).__frames;
    probe.counting = false;
    return probe.gaps;
  });
  return { gaps: seen, taskMs: (after - before) * MS_PER_S, moves };
}

async function run(browser: Browser, target: Target): Promise<Record<Gesture, Seen>> {
  const { base, place, login: needsLogin } = PLACES[target];
  console.log(`load ${loadavg()[0].toFixed(1)} before a ${target} run`);
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  await page.addInitScript(instrument);
  if (needsLogin) {
    await login(page, base);
  }
  await page.goto(`${base}/p/${place.projectId}/c/${place.canvasId}`, { waitUntil: 'commit' });
  await page.locator('[data-canvas-surface]').first().waitFor({ timeout: 120_000 });
  await page.waitForTimeout(SETTLE_MS);
  const seen = {} as Record<Gesture, Seen>;
  for (const gesture of benched()) {
    await page.keyboard.press('Shift+Digit1');
    await page.waitForTimeout(FIT_TOGGLE_MS);
    seen[gesture] = await gaps(page, cdp, gesture);
  }
  await context.close();
  return seen;
}

for (const target of TARGETS) {
  test(`frames stay inside ${FRAME_BUDGET_MS.toFixed(1)} ms on ${target}`, async () => {
    mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ headless: false, args: UNCAPPED });
    const all = Object.fromEntries(benched().map((g) => [g, { gaps: [], taskMs: 0, moves: 0 } as Seen])) as Record<Gesture, Seen>;
    for (let i = 0; i < RUNS; i++) {
      const seen = await run(browser, target);
      console.log(`run ${i + 1}: ${benched().map((g) => `${g} ${(100 * budgetOf(seen[g].gaps).overShare).toFixed(1)}%/${(100 * budgetOf(seen[g].gaps, Rate.ProMotion).overShare).toFixed(1)}%`).join(' ')}`);
      benched().forEach((g) => {
        all[g].gaps.push(...seen[g].gaps);
        all[g].taskMs += seen[g].taskMs / RUNS;
        all[g].moves += seen[g].moves / RUNS;
      });
    }
    await browser.close();
    const report = Object.fromEntries(benched().map((g) => [g, { ...budgetOf(all[g].gaps), taskMs: Math.round(all[g].taskMs), msPerMove: all[g].moves ? Math.round((10 * GESTURE_MS) / all[g].moves) / 10 : null, at120: budgetOf(all[g].gaps, Rate.ProMotion) }]));
    writeFileSync(join(OUT, `frame-budget-${target}.json`), JSON.stringify(report, null, 2));
    console.table(Object.fromEntries(Object.entries(report).map(([g, { at120, ...at90 }]) => [g, { ...at90, p95at120: at120.p95, overAt120: at120.overShare, passedAt120: at120.passed }])));
    expect(Object.entries(report).filter(([, r]) => !r.passed).map(([g]) => g)).toEqual([]);
  });
}

const EDITS_EACH = Number(process.env.BUDGET_EDITS ?? 8);
const EDIT_GIVE_UP_MS = 3000;
const EDIT_PAUSE_MS = 250;
const RESIZE_STEP_PX = 6;
const CHILD_AT = { x: 0.07, y: 0.032 };
const TEXT_AT = { x: 0.51, y: 0.032 };
const TEXT_DESCENTS = 4;

type Stages = { total: number; effect: number; build: number; media: number; upload: number; draw: number; patched: boolean };

function listenInput() {
  const probe = window as unknown as { __editAt: number; __editInputs: number[] };
  probe.__editInputs = [];
  const seen = (e: Event) => {
    probe.__editAt = e.timeStamp;
    probe.__editInputs.push(e.timeStamp);
  };
  addEventListener('keydown', seen, true);
  addEventListener('pointermove', seen, true);
}

async function stagesAfter(page: Page): Promise<Stages | null> {
  return page.evaluate(async (giveUp) => {
    const at = (window as unknown as { __editAt: number }).__editAt;
    const started = performance.now();
    const LIVE = /^frame\|drawn\|(.+:live\d+)$/;
    while (performance.now() - started < giveUp) {
      await new Promise((done) => requestAnimationFrame(done));
      const marks = performance.getEntriesByType('mark').filter((m) => m.startTime >= at);
      const drawn = marks.find((m) => LIVE.test(m.name));
      if (!drawn) {
        continue;
      }
      const group = drawn.name.match(LIVE)![1];
      const of = (step: string) => marks.find((m) => m.name === `frame|${step}|${group}`)?.startTime ?? drawn.startTime;
      const [asked, built, ready, put] = [of('live-asked'), of('live-built'), of('live-ready'), Math.min(of('put'), of('patched'))];
      const patched = !marks.some((m) => m.name === `frame|live-built|${group}`);
      return { total: drawn.startTime - at, effect: asked - at, build: built - asked, media: ready - built, upload: put - ready, draw: drawn.startTime - put, patched };
    }
    return null;
  }, EDIT_GIVE_UP_MS);
}

async function selectChild(page: Page) {
  const box = await frameOnScreen(page);
  await page.mouse.click(box.x + box.w * CHILD_AT.x, box.y + box.w * CHILD_AT.y);
  await page.getByTestId('frame-selection').first().waitFor({ timeout: 10_000 });
}

async function resizeEdits(page: Page, count: number): Promise<(Stages | null)[]> {
  const edge = (await page.getByTestId('frame-selection-edge').nth(1).boundingBox())!;
  const from = { x: edge.x + edge.width / 2, y: edge.y + edge.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const seen: (Stages | null)[] = [];
  for (let i = 1; i <= count; i++) {
    await page.mouse.move(from.x + i * RESIZE_STEP_PX, from.y);
    seen.push(await stagesAfter(page));
  }
  await page.mouse.up();
  return seen;
}

const KEYS: Record<Exclude<Edit, Edit.Resize | Edit.Text>, [string, string]> = {
  [Edit.Nudge]: ['ArrowRight', 'ArrowLeft'],
  [Edit.Opacity]: ['Digit5', 'Digit0'],
  [Edit.Hide]: ['ControlOrMeta+Shift+KeyH', 'ControlOrMeta+Shift+KeyH']
};

function holdBuilds() {
  const probe = window as unknown as { __hold: boolean; __held: (() => void)[] };
  probe.__hold = false;
  probe.__held = [];
  const Real = Worker;
  window.Worker = class extends Real {
    constructor(url: string | URL, options?: WorkerOptions) {
      super(url, options);
      if (!String(url).includes('frame-build')) {
        return;
      }
      const set = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage')!.set!;
      Object.defineProperty(this, 'onmessage', {
        set: (handler: ((e: MessageEvent) => void) | null) => set.call(this, handler && ((e: MessageEvent) => (probe.__hold ? probe.__held.push(() => handler(e)) : handler(e))))
      });
    }
  };
}

const holding = (page: Page, on: boolean) =>
  page.evaluate((hold) => {
    const probe = window as unknown as { __hold: boolean; __held: (() => void)[] };
    probe.__hold = hold;
    if (!hold) {
      probe.__held.splice(0).forEach((run) => run());
    }
  }, on);

async function frameShot(page: Page): Promise<{ data: Buffer; size: number }> {
  const box = await frameOnScreen(page);
  const png = await page.screenshot({ clip: { x: box.x, y: box.y, width: Math.min(box.w, VIEWPORT.width - box.x), height: Math.min(box.h, VIEWPORT.height - box.y) } });
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  return { data, size: info.width * info.height };
}

function differing(a: { data: Buffer; size: number }, b: { data: Buffer; size: number }): number {
  if (a.size !== b.size) {
    return PERCENT;
  }
  const channels = a.data.length / a.size;
  let off = 0;
  for (let p = 0; p < a.size; p++) {
    for (let c = 0; c < channels; c++) {
      if (Math.abs(a.data[p * channels + c] - b.data[p * channels + c]) > PIXEL_TOLERANCE) {
        off++;
        break;
      }
    }
  }
  return (PERCENT * off) / a.size;
}

const shotDiffs: Record<string, number[]> = {};

async function shotEdit(page: Page, key: string, edit: string): Promise<Stages | null> {
  await holding(page, true);
  await page.keyboard.press(key);
  const stages = await stagesAfter(page);
  const patched = stages?.patched ? await frameShot(page) : null;
  await holding(page, false);
  await page.waitForTimeout(SHOT_SETTLE_MS);
  if (patched) {
    (shotDiffs[edit] ??= []).push(differing(patched, await frameShot(page)));
  }
  return stages;
}

async function keyEdits(page: Page, keys: [string, string], count: number, edit: string): Promise<(Stages | null)[]> {
  const seen: (Stages | null)[] = [];
  for (let i = 0; i < count; i++) {
    if (SHOTS) {
      seen.push(await shotEdit(page, keys[i % 2], edit));
      continue;
    }
    await page.keyboard.press(keys[i % 2]);
    seen.push(await stagesAfter(page));
    await page.waitForTimeout(EDIT_PAUSE_MS);
  }
  return seen;
}

async function textEdits(page: Page, count: number): Promise<(Stages | null)[]> {
  const box = await frameOnScreen(page);
  const field = page.getByTestId('core-text-edit');
  for (let i = 0; i < TEXT_DESCENTS && !(await field.isVisible()); i++) {
    await page.mouse.dblclick(box.x + box.w * TEXT_AT.x, box.y + box.w * TEXT_AT.y);
    await page.waitForTimeout(EDIT_PAUSE_MS);
  }
  await field.waitFor({ timeout: 10_000 });
  await field.press('End');
  const seen: (Stages | null)[] = [];
  for (let i = 0; i < count; i++) {
    await field.evaluate((el, giveUp) => {
      (window as unknown as { __typed: Promise<Stages | null> }).__typed = new Promise<Stages | null>((done) => {
        setTimeout(() => done(null), giveUp);
        el.addEventListener('input', (e) => requestAnimationFrame(() => {
          const at = (window as unknown as { __editAt: number }).__editAt;
          done({ total: performance.now() - at, effect: e.timeStamp - at, build: 0, media: 0, upload: 0, draw: performance.now() - e.timeStamp, patched: false });
        }), { once: true });
      });
    }, EDIT_GIVE_UP_MS);
    await field.press('KeyA');
    seen.push(await page.evaluate(() => (window as unknown as { __typed: Promise<Stages | null> }).__typed));
    await page.waitForTimeout(EDIT_PAUSE_MS);
  }
  await page.keyboard.press('Escape');
  return seen;
}

async function edits(page: Page, edit: Edit): Promise<(Stages | null)[]> {
  if (edit === Edit.Text) {
    return textEdits(page, EDITS_EACH);
  }
  await selectChild(page);
  if (edit === Edit.Resize) {
    return resizeEdits(page, EDITS_EACH);
  }
  return keyEdits(page, KEYS[edit], EDITS_EACH, edit);
}

const mean = (xs: number[]) => (xs.length ? Math.round((10 * xs.reduce((a, b) => a + b, 0)) / xs.length) / 10 : 0);

function breakdown(seen: Stages[]) {
  const stage = (k: Exclude<keyof Stages, 'patched'>) => mean(seen.map((s) => s[k]));
  return { effect: stage('effect'), build: stage('build'), media: stage('media'), upload: stage('upload'), draw: stage('draw'), patched: seen.filter((s) => s.patched).length };
}


async function profiling(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: PROFILE_SAMPLE_US });
  await cdp.send('Profiler.start');
  return cdp;
}

async function editRun(browser: Browser, target: Target): Promise<Record<Edit, (Stages | null)[]>> {
  const { base, place, login: needsLogin } = PLACES[target];
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(listenInput);
  if (SHOTS) {
    await page.addInitScript(holdBuilds);
  }
  if (needsLogin) {
    await login(page, base);
  }
  await page.goto(`${base}/p/${place.projectId}/c/${place.canvasId}`, { waitUntil: 'commit' });
  await page.locator('[data-canvas-surface]').first().waitFor({ timeout: 120_000 });
  await page.waitForTimeout(SETTLE_MS);
  const seen = {} as Record<Edit, (Stages | null)[]>;
  for (const edit of Object.values(Edit).filter((e) => !EDIT_KINDS || EDIT_KINDS.includes(e))) {
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Shift+Digit1');
    await page.waitForTimeout(FIT_TOGGLE_MS);
    await zoomOntoFrame(page);
    const cdp = PROFILED ? await profiling(page) : null;
    const startedAt = await page.evaluate(() => performance.now());
    seen[edit] = await edits(page, edit).catch((e: unknown) => (console.log(`${edit}: ${e}`), []));
    if (cdp) {
      const { profile } = await cdp.send('Profiler.stop');
      writeFileSync(join(OUT, `edit-${target}-${edit}.cpuprofile`), JSON.stringify(profile));
      const windows = await page.evaluate(() => ({
        inputs: (window as unknown as { __editInputs: number[] }).__editInputs,
        asked: performance.getEntriesByType('mark').filter((m) => m.name.startsWith('frame|live-asked|')).map((m) => m.startTime)
      }));
      writeFileSync(join(OUT, `edit-${target}-${edit}.windows.json`), JSON.stringify({ startedAt, ...windows }));
    }
  }
  await context.close();
  return seen;
}

for (const target of TARGETS) {
  test(`edits reach the screen inside ${EDIT_BUDGET_MS.toFixed(1)} ms on ${target}`, async () => {
    mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ headless: false, args: UNCAPPED });
    const all = Object.fromEntries(Object.values(Edit).map((e) => [e, [] as (Stages | null)[]])) as Record<Edit, (Stages | null)[]>;
    for (let i = 0; i < RUNS; i++) {
      const seen = await editRun(browser, target);
      Object.values(Edit).forEach((e) => all[e].push(...(seen[e] ?? [])));
    }
    await browser.close();
    const report = Object.fromEntries(
      Object.values(Edit).filter((e) => !EDIT_KINDS || EDIT_KINDS.includes(e)).map((e) => {
        const landed = all[e].filter((s): s is Stages => s !== null);
        return [e, { ...editBudgetOf(landed.map((s) => s.total)), missed: all[e].length - landed.length, ...breakdown(landed) }];
      })
    );
    writeFileSync(join(OUT, `edit-latency-${target}.json`), JSON.stringify(report, null, 2));
    if (SHOTS) {
      writeFileSync(join(OUT, `edit-shots-${target}.json`), JSON.stringify(shotDiffs, null, 2));
      console.table(Object.fromEntries(Object.entries(shotDiffs).map(([e, d]) => [e, { shots: d.length, maxPercent: Math.max(...d), meanPercent: d.reduce((x, y) => x + y, 0) / d.length }])));
    }
    console.table(report);
    expect(Object.entries(report).filter(([, r]) => !r.passed).map(([e]) => e)).toEqual([]);
  });
}
