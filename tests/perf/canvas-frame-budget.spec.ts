import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, chromium, type Browser, type Page } from '@playwright/test';
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
const TITLE_ABOVE_PX = 10;
const TITLE_IN_PX = 30;
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

async function frameOnScreen(page: Page): Promise<Box> {
  const boxes = await page.locator('[data-testid="gpu-node"]').evaluateAll((nodes) => nodes.map((n) => n.getBoundingClientRect()).map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })));
  return boxes.find((b) => b.x > 0 && b.x + b.w / 2 < VIEWPORT.width && b.y > TITLE_ABOVE_PX * 2 && b.y < VIEWPORT.height / 2) ?? boxes[0];
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

async function drag(page: Page, until: number) {
  const box = await frameOnScreen(page);
  const from = { x: box.x + TITLE_IN_PX, y: box.y - TITLE_ABOVE_PX };
  await page.mouse.click(from.x, from.y);
  await page.mouse.down();
  for (let i = 0; Date.now() < until; i++) {
    const t = i / 10;
    await page.mouse.move(from.x + Math.sin(t) * DRAG_SWING.x, from.y + Math.cos(t * 0.7) * DRAG_SWING.y);
  }
  await page.mouse.move(from.x, from.y);
  await page.mouse.up();
  await page.keyboard.press('Escape');
}

const GESTURES: Record<Gesture, (page: Page, until: number) => Promise<void>> = {
  [Gesture.Pan]: wheelPan,
  [Gesture.Zoom]: zoom,
  [Gesture.Fit]: fit,
  [Gesture.Drag]: drag
};

async function gaps(page: Page, gesture: Gesture): Promise<number[]> {
  await page.evaluate(() => Object.assign((window as unknown as { __frames: object }).__frames, { gaps: [], work: [], counting: true }));
  await GESTURES[gesture](page, Date.now() + GESTURE_MS);
  return page.evaluate(() => {
    const probe = (window as unknown as { __frames: { gaps: number[]; counting: boolean } }).__frames;
    probe.counting = false;
    return probe.gaps;
  });
}

async function run(browser: Browser, target: Target): Promise<Record<Gesture, number[]>> {
  const { base, place, login: needsLogin } = PLACES[target];
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.addInitScript(instrument);
  if (needsLogin) {
    await login(page, base);
  }
  await page.goto(`${base}/p/${place.projectId}/c/${place.canvasId}`, { waitUntil: 'commit' });
  await page.locator('[data-canvas-surface]').first().waitFor({ timeout: 120_000 });
  await page.waitForTimeout(SETTLE_MS);
  const seen = {} as Record<Gesture, number[]>;
  for (const gesture of Object.values(Gesture)) {
    await page.keyboard.press('Shift+Digit1');
    await page.waitForTimeout(FIT_TOGGLE_MS);
    seen[gesture] = await gaps(page, gesture);
  }
  await context.close();
  return seen;
}

for (const target of TARGETS) {
  test(`frames stay inside ${FRAME_BUDGET_MS.toFixed(1)} ms on ${target}`, async () => {
    mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ headless: false, args: UNCAPPED });
    const all = Object.fromEntries(Object.values(Gesture).map((g) => [g, [] as number[]])) as Record<Gesture, number[]>;
    for (let i = 0; i < RUNS; i++) {
      const seen = await run(browser, target);
      Object.values(Gesture).forEach((g) => all[g].push(...seen[g]));
    }
    await browser.close();
    const report = Object.fromEntries(Object.values(Gesture).map((g) => [g, budgetOf(all[g])]));
    writeFileSync(join(OUT, `frame-budget-${target}.json`), JSON.stringify(report, null, 2));
    console.table(report);
    expect(Object.entries(report).filter(([, r]) => !r.passed).map(([g]) => g)).toEqual([]);
  });
}
