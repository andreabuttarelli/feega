import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, chromium, type Browser, type CDPSession, type Page } from '@playwright/test';
import { instrument, wheelPan } from '../e2e/fixtures/frame-sweeps';
import { LANDINGS_FIXTURE_PLACE } from '../../scripts/perf/landings-fixture.mjs';
import { budgetOf, FRAME_BUDGET_MS } from '../../scripts/perf/frame-budget';

enum Gesture {
  Pan = 'pan',
  Zoom = 'zoom',
  Fit = 'fit',
  Drag = 'drag'
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

async function zoom(page: Page, until: number) {
  await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
  await page.keyboard.down('Control');
  for (let i = 0; Date.now() < until; i++) {
    await page.mouse.wheel(0, Math.floor(i / ZOOM_STEPS_EACH_WAY) % 2 ? ZOOM_WHEEL_PX : -ZOOM_WHEEL_PX);
  }
  await page.keyboard.up('Control');
}

async function fit(page: Page, until: number) {
  for (let i = 0; Date.now() < until; i++) {
    await page.keyboard.press(i % 2 ? 'Shift+Digit0' : 'Shift+Digit1');
    await page.waitForTimeout(FIT_TOGGLE_MS);
  }
}

async function drag(page: Page, until: number, aim?: string) {
  const box = (await tiles(page)).find((t) => t.id === aim) ?? (await frameOnScreen(page));
  const from = labelAt(box);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  let moves = 0;
  for (; Date.now() < until; moves++) {
    const t = moves / 10;
    await page.mouse.move(from.x + Math.sin(t) * DRAG_SWING.x, from.y + Math.sin(t * 0.7) * DRAG_SWING.y);
  }
  const moved = (await placeOf(page, box.id)) !== box.at;
  console.log(`drag: ${moves} moves on ${box.id}`);
  await page.mouse.move(from.x, from.y);
  await page.mouse.up();
  await page.keyboard.press('Escape');
  if (!moved) {
    throw new Error(`drag: frame ${box.id} did not move`);
  }
}

const GESTURES: Record<Gesture, (page: Page, until: number, aim?: string) => Promise<void>> = {
  [Gesture.Pan]: wheelPan,
  [Gesture.Zoom]: zoom,
  [Gesture.Fit]: fit,
  [Gesture.Drag]: drag
};

type Seen = { gaps: number[]; taskMs: number };

async function taskSeconds(cdp: CDPSession): Promise<number> {
  const { metrics } = await cdp.send('Performance.getMetrics');
  return metrics.find((m) => m.name === 'TaskDuration')?.value ?? 0;
}

const SETUP: Partial<Record<Gesture, (page: Page) => Promise<string>>> = {
  [Gesture.Drag]: zoomOntoFrame
};

async function gaps(page: Page, cdp: CDPSession, gesture: Gesture): Promise<Seen> {
  const aim = await SETUP[gesture]?.(page);
  await page.evaluate(() => Object.assign((window as unknown as { __frames: object }).__frames, { gaps: [], work: [], counting: true }));
  const before = await taskSeconds(cdp);
  await GESTURES[gesture](page, Date.now() + GESTURE_MS, aim);
  const after = await taskSeconds(cdp);
  const seen = await page.evaluate(() => {
    const probe = (window as unknown as { __frames: { gaps: number[]; counting: boolean } }).__frames;
    probe.counting = false;
    return probe.gaps;
  });
  return { gaps: seen, taskMs: (after - before) * MS_PER_S };
}

async function run(browser: Browser, target: Target): Promise<Record<Gesture, Seen>> {
  const { base, place, login: needsLogin } = PLACES[target];
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
  for (const gesture of Object.values(Gesture)) {
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
    const all = Object.fromEntries(Object.values(Gesture).map((g) => [g, { gaps: [], taskMs: 0 } as Seen])) as Record<Gesture, Seen>;
    for (let i = 0; i < RUNS; i++) {
      const seen = await run(browser, target);
      Object.values(Gesture).forEach((g) => {
        all[g].gaps.push(...seen[g].gaps);
        all[g].taskMs += seen[g].taskMs / RUNS;
      });
    }
    await browser.close();
    const report = Object.fromEntries(Object.values(Gesture).map((g) => [g, { ...budgetOf(all[g].gaps), taskMs: Math.round(all[g].taskMs) }]));
    writeFileSync(join(OUT, `frame-budget-${target}.json`), JSON.stringify(report, null, 2));
    console.table(report);
    expect(Object.entries(report).filter(([, r]) => !r.passed).map(([g]) => g)).toEqual([]);
  });
}
