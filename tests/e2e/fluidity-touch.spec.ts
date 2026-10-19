import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { test, expect, devices, webkit, type Page } from '@playwright/test';

type Point = { x: number; y: number };
type Facts = { inputP95: number | null; inputs: number; frameP95: number | null; frames: number; memoryMb: number };
type Row = { device: string; canvas: string; run: number; step: string; facts: Facts | null; error: string | null };
type Step = { name: string; drive: (page: Page) => Promise<void> };

enum Device {
  IPhone = 'iphone',
  Desktop = 'desktop'
}

const DEVICE_OF: Record<Device, (typeof devices)[string]> = {
  [Device.IPhone]: devices['iPhone 15'],
  [Device.Desktop]: { ...devices['Desktop Safari'], hasTouch: true }
};

const HEAVY = { projectId: 'e472ff3c-4b1f-4b95-8f31-695e7940b40a', canvasId: 'b5a892f3-3112-41b3-ab8c-5f7d0d69887d' };
const RUNS = Number(process.env.FLUID_RUNS ?? 3);
const ONLY = process.env.FLUID_STEPS ? new RegExp(process.env.FLUID_STEPS) : null;
const DEVICES = (process.env.FLUID_DEVICES ?? `${Device.IPhone},${Device.Desktop}`).split(',') as Device[];
const OUT = process.env.FLUID_OUT ?? join(homedir(), 'Documents', 'feega-videos', 'fluidity-touch');
const SETTLE_MS = 8_000;
const STEP_MS = 30_000;
const AFTER_STEP_MS = 800;
const MOVES = 24;
const DRAG_PX = 40;
const PINCH_FROM_PX = 60;
const PINCH_TO_PX = 140;
const PAN_PX = 120;
const MIN_TARGET_PX = 60;
const ZOOM_TRIES = 12;
const PLAY_MS = 3_000;
const SCRUB_MOVES = 30;
const TYPED = 'Fluid';
const COLOURS = ['#e11d48', '#16a34a', '#2563eb', '#f59e0b', '#9333ea', '#0ea5e9'];
const KB_PER_MB = 1024;
const WEBKIT_PROCESS = /WebKit\.(WebContent|GPU)/;
const NODE = '.svelte-flow__node[data-id]';
const MOTION_NODE = `${NODE}:has([data-testid="motion-node"])`;
const SURFACE = '[data-canvas-surface]';

function install() {
  const w = window as unknown as { __touch?: unknown };
  if (w.__touch) {
    return;
  }
  let on = false;
  let frames: number[] = [];
  let inputs: number[] = [];
  let last = 0;
  const tick = (t: number) => {
    if (on && last) {
      frames.push(t - last);
    }
    last = t;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const listen = (e: Event) => {
    if (!on) {
      return;
    }
    const at = e.timeStamp;
    requestAnimationFrame(() => requestAnimationFrame(() => inputs.push(performance.now() - at)));
  };
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'click', 'dblclick', 'input', 'keydown', 'touchstart', 'touchmove']) {
    window.addEventListener(type, listen, { capture: true, passive: true });
  }
  w.__touch = {
    start: () => {
      on = true;
      frames = [];
      inputs = [];
    },
    stop: () => {
      on = false;
      return { frames, inputs };
    }
  };
}

const p95 = (xs: number[]): number | null => (xs.length ? Math.round([...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * 0.95))]) : null);

const webkitPids = (): Set<string> =>
  new Set(
    execSync('ps -axo pid=,comm=')
      .toString()
      .split('\n')
      .filter((l) => WEBKIT_PROCESS.test(l))
      .map((l) => l.trim().split(/\s+/)[0])
  );

function rssMb(mine: Set<string>): number {
  let total = 0;
  for (const line of execSync('ps -axo pid=,rss=').toString().split('\n')) {
    const [pid, kb] = line.trim().split(/\s+/);
    if (mine.has(pid)) {
      total += Number(kb) / KB_PER_MB;
    }
  }
  return Math.round(total);
}

async function fingers(page: Page, paths: Point[][]) {
  await page.evaluate(async (tracks) => {
    const ids = tracks.map((_, i) => 100 + i);
    const target = document.elementFromPoint(tracks[0][0].x, tracks[0][0].y) ?? document.body;
    const frame = () => new Promise((r) => requestAnimationFrame(r));
    const touchList = (at: number) => {
      try {
        return tracks.map((t, i) => new Touch({ identifier: ids[i], target, clientX: t[at].x, clientY: t[at].y }));
      } catch {
        return null;
      }
    };
    const touch = (type: string, at: number) => {
      const list = touchList(at);
      if (!list) {
        return;
      }
      const active = type === 'touchend' ? [] : list;
      target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: active, targetTouches: active, changedTouches: list }));
    };
    const pointer = (type: string, at: number) =>
      tracks.forEach((t, i) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: ids[i], pointerType: 'touch', isPrimary: i === 0, clientX: t[at].x, clientY: t[at].y, buttons: type === 'pointerup' ? 0 : 1 })));
    touch('touchstart', 0);
    pointer('pointerdown', 0);
    for (let at = 1; at < tracks[0].length; at++) {
      await frame();
      touch('touchmove', at);
      pointer('pointermove', at);
    }
    const end = tracks[0].length - 1;
    touch('touchend', end);
    pointer('pointerup', end);
  }, paths);
}

const line = (from: Point, dx: number, dy: number): Point[] => Array.from({ length: MOVES + 1 }, (_, i) => ({ x: from.x + (dx * i) / MOVES, y: from.y + (dy * i) / MOVES }));

async function centre(page: Page, selector: string): Promise<Point> {
  const box = (await page.locator(selector).first().boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + Math.min(box.height / 2, 200) };
}

async function emptyPoint(page: Page): Promise<Point> {
  const found = await page.evaluate(() => {
    for (let y = 160; y < innerHeight - 160; y += 24) {
      for (let x = 40; x < innerWidth - 40; x += 24) {
        if (document.elementFromPoint(x, y)?.classList.contains('svelte-flow__pane')) {
          return { x, y };
        }
      }
    }
    return null;
  });
  return found ?? { x: page.viewportSize()!.width / 2, y: page.viewportSize()!.height / 2 };
}

async function bringMotionNodeIntoReach(page: Page) {
  const node = page.locator(MOTION_NODE).first();
  for (let i = 0; i < ZOOM_TRIES; i++) {
    const box = await node.boundingBox();
    if (box && box.width >= MIN_TARGET_PX && box.x > 0 && box.y > 60) {
      return;
    }
    const at = box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : await emptyPoint(page);
    await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.dispatchEvent(new WheelEvent('wheel', { clientX: x, clientY: y, deltaY: -80, ctrlKey: true, bubbles: true, cancelable: true })), [at.x, at.y]);
    await page.waitForTimeout(250);
  }
}

async function tapSequence(page: Page, ...ids: string[]) {
  for (const id of ids) {
    await page.getByTestId(id).tap();
  }
}

const STEPS: Step[] = [
  { name: 'tap select', drive: async (page) => { const at = await centre(page, MOTION_NODE); await page.touchscreen.tap(at.x, at.y); await expect(page.locator(MOTION_NODE).first()).toHaveClass(/selected/); } },
  { name: 'drag move', drive: async (page) => { const at = await centre(page, MOTION_NODE); await fingers(page, [line(at, DRAG_PX, 0)]); await fingers(page, [line({ x: at.x + DRAG_PX, y: at.y }, -DRAG_PX, 0)]); } },
  { name: 'pinch zoom', drive: async (page) => { const at = await emptyPoint(page); await fingers(page, [line({ x: at.x - PINCH_FROM_PX / 2, y: at.y }, -(PINCH_TO_PX - PINCH_FROM_PX) / 2, 0), line({ x: at.x + PINCH_FROM_PX / 2, y: at.y }, (PINCH_TO_PX - PINCH_FROM_PX) / 2, 0)]); } },
  { name: 'two-finger pan', drive: async (page) => { const at = await emptyPoint(page); await fingers(page, [line(at, PAN_PX, PAN_PX / 2), line({ x: at.x + PINCH_FROM_PX, y: at.y }, PAN_PX, PAN_PX / 2)]); } },
  { name: 'insert sheet', drive: async (page) => { await tapSequence(page, 'mobile-view-insert'); await expect(page.getByTestId('insert-sheet')).toBeVisible(); await page.getByTestId('mobile-view-insert').tap(); await expect(page.getByTestId('insert-sheet')).toBeHidden(); } },
  { name: 'layers sheet', drive: async (page) => { await tapSequence(page, 'mobile-view-layers'); await expect(page.getByTestId('mobile-layers')).toBeVisible(); await page.getByTestId('mobile-view-layers').tap(); await expect(page.getByTestId('mobile-layers')).toBeHidden(); } },
  { name: 'double-tap open', drive: async (page) => { await bringMotionNodeIntoReach(page); const at = await centre(page, MOTION_NODE); await page.touchscreen.tap(at.x, at.y); await page.touchscreen.tap(at.x, at.y); if (!(await page.getByTestId('motion-editor').count())) { await page.locator(MOTION_NODE).first().dblclick({ position: { x: 20, y: 40 } }); } await expect(page.getByTestId('motion-editor')).toBeVisible(); await page.waitForTimeout(SETTLE_MS / 2); } },
  { name: 'timeline scrub', drive: async (page) => { const ruler = (await page.getByRole('slider', { name: 'Playhead' }).boundingBox())!; const from = { x: ruler.x + 10, y: ruler.y + ruler.height / 2 }; await fingers(page, [Array.from({ length: SCRUB_MOVES + 1 }, (_, i) => ({ x: from.x + ((ruler.width - 20) * i) / SCRUB_MOVES, y: from.y }))]); } },
  { name: 'playback', drive: async (page) => { await page.keyboard.press('Space'); await page.waitForTimeout(PLAY_MS); await page.keyboard.press('Space'); } },
  { name: 'properties sheet', drive: async (page) => { await page.getByTestId('phone-tab-layers').tap(); await page.locator('aside.layers-sheet [data-kind="clip"]').first().tap(); await expect(page.locator('aside.props')).toBeVisible(); } },
  { name: 'typing in place', drive: async (page) => { const field = page.locator('aside.props input[type="text"]:visible').first(); const was = await field.inputValue(); await field.tap(); await field.press('End'); await page.keyboard.type(TYPED, { delay: 60 }); await field.fill(was); await field.press('Enter'); } },
  { name: 'colour drag', drive: async (page) => { await page.getByTestId('fill-swatch').first().tap(); await page.getByTestId('fill-editor').locator('.colour .chip').first().tap(); const wheel = page.getByTestId('colour-popover').locator('input[type=color]'); const was = await wheel.inputValue(); for (const hex of [...COLOURS, was]) { await wheel.evaluate((el: HTMLInputElement, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, hex); await page.waitForTimeout(50); } await wheel.evaluate((el: HTMLInputElement) => el.dispatchEvent(new Event('change', { bubbles: true }))); await page.keyboard.press('Escape'); } },
  { name: 'editor close', drive: async (page) => { for (let i = 0; i < 3 && (await page.getByTestId('motion-editor').count()); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); } await expect(page.getByTestId('motion-editor')).toHaveCount(0); } }
];

async function lightCanvas(db: SupabaseClient): Promise<{ projectId: string; canvasId: string }> {
  if (process.env.FLUID_LIGHT) {
    const [projectId, canvasId] = process.env.FLUID_LIGHT.split('/');
    return { projectId, canvasId };
  }
  const motion = await db.from('nodes').select('canvas_id').eq('type', 'motion').is('deleted_at', null).neq('canvas_id', HEAVY.canvasId).limit(200);
  const candidates = [...new Set((motion.data ?? []).map((n) => n.canvas_id as string))];
  let best: { canvasId: string; count: number } | null = null;
  for (const canvasId of candidates) {
    const { count } = await db.from('nodes').select('id', { count: 'exact', head: true }).eq('canvas_id', canvasId).is('deleted_at', null);
    best = !best || (count ?? 0) < best.count ? { canvasId, count: count ?? 0 } : best;
  }
  if (!best) {
    throw new Error('no light canvas with a motion node in the test account: set FLUID_LIGHT=<projectId>/<canvasId>');
  }
  const canvas = await db.from('canvases').select('project_id').eq('id', best.canvasId).single();
  return { projectId: canvas.data!.project_id as string, canvasId: best.canvasId };
}

async function login(page: Page, base: string) {
  await page.goto(`${base}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function session(base: string, device: Device, canvas: { projectId: string; canvasId: string }, label: string, run: number): Promise<Row[]> {
  const before = webkitPids();
  const browser = await webkit.launch();
  const rows: Row[] = [];
  try {
    const page = await (await browser.newContext({ ...DEVICE_OF[device], serviceWorkers: 'block' })).newPage();
    const mine = new Set([...webkitPids()].filter((p) => !before.has(p)));
    await login(page, base);
    await page.addInitScript(install);
    await page.goto(`${base}/p/${canvas.projectId}/c/${canvas.canvasId}`);
    await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 5_000 }).catch(() => undefined);
    await expect(page.locator(SURFACE).first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    await bringMotionNodeIntoReach(page);
    page.setDefaultTimeout(10_000);
    for (const step of STEPS.filter((s) => !ONLY || ONLY.test(s.name))) {
      await page.evaluate(() => (window as unknown as { __touch: { start: () => void } }).__touch.start());
      let peak = rssMb(mine);
      const sampler = setInterval(() => (peak = Math.max(peak, rssMb(mine))), 250);
      let error: string | null = null;
      try {
        await Promise.race([step.drive(page), new Promise<never>((_, no) => setTimeout(() => no(new Error(`over ${STEP_MS} ms`)), STEP_MS))]);
        await page.waitForTimeout(AFTER_STEP_MS);
      } catch (err) {
        error = String(err).replace(/\x1b\[[0-9;]*m/g, '').split('\n')[0].slice(0, 200);
      }
      clearInterval(sampler);
      const got = await page.evaluate(() => (window as unknown as { __touch: { stop: () => { frames: number[]; inputs: number[] } } }).__touch.stop());
      const facts = { inputP95: p95(got.inputs), inputs: got.inputs.length, frameP95: p95(got.frames), frames: got.frames.length, memoryMb: peak };
      rows.push({ device, canvas: label, run, step: step.name, facts, error });
      console.log(`[touch] ${device} ${label} #${run} ${step.name} ${error ? `UNDRIVEN ${error}` : JSON.stringify(facts)}`);
    }
  } finally {
    await browser.close();
  }
  return rows;
}

const median = (xs: (number | null)[]): string => {
  const ok = xs.filter((x): x is number => x !== null).sort((a, b) => a - b);
  return ok.length ? String(ok[Math.floor(ok.length / 2)]) : '–';
};

function table(rows: Row[]): string {
  const keys = [...new Set(rows.map((r) => `${r.device}|${r.canvas}|${r.step}`))];
  const lines = ['| device | canvas | step | input→paint p95 ms | frame p95 ms | peak RSS MB | undriven |', '|---|---|---|---|---|---|---|'];
  for (const key of keys) {
    const group = rows.filter((r) => `${r.device}|${r.canvas}|${r.step}` === key);
    const ok = group.filter((r) => !r.error);
    const [device, canvas, step] = key.split('|');
    lines.push(`| ${device} | ${canvas} | ${step} | ${median(ok.map((r) => r.facts!.inputP95))} | ${median(ok.map((r) => r.facts!.frameP95))} | ${median(ok.map((r) => r.facts!.memoryMb))} | ${group.length - ok.length}/${group.length} ${group.find((r) => r.error)?.error ?? ''} |`);
  }
  return lines.join('\n');
}

test.describe('touch fluidity scorecard @real', () => {
  test.skip(!process.env.FLUID_TOUCH || !process.env.E2E_TEST_EMAIL, 'needs FLUID_TOUCH=1 and the test account owning the heavy canvas copy');
  test.setTimeout(3_600_000);

  test('every step driven by touch, heavy and light canvas, iPhone and desktop Safari', async ({ baseURL }) => {
    const db = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const signed = await db.auth.signInWithPassword({ email: process.env.E2E_TEST_EMAIL!, password: process.env.E2E_TEST_PASSWORD! });
    expect(signed.error).toBeNull();
    const canvases = { heavy: HEAVY, light: await lightCanvas(db) };
    const rows: Row[] = [];
    for (const device of DEVICES) {
      for (const [label, canvas] of Object.entries(canvases)) {
        for (let run = 1; run <= RUNS; run++) {
          rows.push(...(await session(baseURL!, device, canvas, label, run)));
        }
      }
    }
    mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, `rows-${Date.now()}.json`), JSON.stringify(rows, null, 2));
    writeFileSync(join(OUT, 'SCORECARD.md'), table(rows));
    console.log(table(rows));
    expect(rows.filter((r) => r.error).map((r) => `${r.device} ${r.canvas} ${r.step}: ${r.error}`), 'every step is driven').toEqual([]);
  });
});
