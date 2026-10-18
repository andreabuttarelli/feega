import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { REAL_STACK, signInE2e } from './fixtures/session';
import { pickBarTool } from './fixtures/canvas-bar';
import { FluidProbe, Read, type Box, type PixelWatch, type Watch } from './fixtures/fluidity-probe';
import { scorecard, verdictOf, type SessionRun, type StepResult } from './fixtures/fluidity-report';

const OUT = process.env.FLUID_OUT ?? join(homedir(), 'Documents', 'feega-videos', 'fluidity');
const SLUG = process.env.FLUID_PROJECT_SLUG ?? 'gpu-fixture-0aef6d1a';
const RENDERERS = (process.env.FLUID_RENDERERS ?? 'gpu,dom').split(',');
const VIEWPORT = { width: 1440, height: 900 };
const COLOURS = ['#e11d48', '#16a34a', '#2563eb', '#f59e0b', '#9333ea'];
const SETTLE_MS = 1200;
const OPEN_MS = 8_000;
const SURFACE = '[data-canvas-surface], .svelte-flow';
const STEP_MS = 45_000;
const MOVE_PX = 36;
const UNTOUCHED_SAMPLES = 6;
const PROMPT = 'Moody product shot, rim light';
const TYPED = 'Fluid';

type Ctx = { page: Page; ids: Map<string, string>; watch: (w: Watch[]) => Promise<void> };
type Outcome = { touched: string[]; watches?: Watch[]; pixels?: PixelWatch[]; expected?: { id: string; value: string }[] };
type Step = { name: string; drive: (c: Ctx) => Promise<Outcome> };
type StepRun = StepResult;

const nodeSel = (id: string) => `.svelte-flow__node[data-id="${id}"]`;
const fillHex = (page: Page) => page.getByTestId('fill-editor').locator('input.hex').first();

async function testAccount(): Promise<{ db: SupabaseClient; userId: string }> {
  const db = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const signed = await db.auth.signInWithPassword({ email: process.env.E2E_TEST_EMAIL!, password: process.env.E2E_TEST_PASSWORD! });
  if (signed.error) {
    throw new Error(signed.error.message);
  }
  return { db, userId: signed.data.user!.id };
}

async function fixtureCanvas(db: SupabaseClient): Promise<{ projectId: string; canvasId: string }> {
  const project = await db.from('projects').select('id').eq('slug', SLUG).single();
  if (project.error) {
    throw new Error(`heavy canvas copy ${SLUG} missing in the test org: refresh it with copy-canvas.mjs`);
  }
  const canvas = await db.from('canvases').select('id').eq('project_id', project.data.id).limit(1).single();
  return { projectId: project.data.id, canvasId: canvas.data!.id };
}

async function liveNodeIds(db: SupabaseClient, canvasId: string): Promise<Set<string>> {
  const { data } = await db.from('nodes').select('id').eq('canvas_id', canvasId).is('deleted_at', null);
  return new Set((data ?? []).map((n) => n.id as string));
}

async function emptySpot(page: Page, size = { width: 260, height: 180 }): Promise<Box> {
  const spot = await page.evaluate((s) => {
    const free = (x: number, y: number) => document.elementFromPoint(x, y)?.classList.contains('svelte-flow__pane') ?? false;
    for (let y = 120; y + s.height < innerHeight - 120; y += 30) {
      for (let x = 120; x + s.width < innerWidth - 380; x += 30) {
        let ok = true;
        for (let dy = 0; ok && dy <= s.height; dy += s.height / 4) {
          for (let dx = 0; ok && dx <= s.width; dx += s.width / 4) {
            ok = free(x + dx, y + dy);
          }
        }
        if (ok) {
          return { x, y, ...s };
        }
      }
    }
    return null;
  }, size);
  if (!spot) {
    throw new Error('no empty spot in view');
  }
  return spot;
}

async function clickEmpty(page: Page) {
  const spot = await emptySpot(page, { width: 40, height: 40 });
  await page.mouse.click(spot.x + 20, spot.y + 20);
}

async function leaveEditor(page: Page) {
  for (let i = 0; i < 4 && (await page.getByTestId('motion-editor').count()); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
  await expect(page.getByTestId('motion-editor')).toHaveCount(0, { timeout: OPEN_MS });
}

const GEN_NODE = ['text', 'image', 'video'].map((t) => `.svelte-flow__node[data-kind="${t}"], .svelte-flow__node-${t}`).join(', ');
const FRAME_NODE = '[data-motion-node]:not([data-kind="element"])';

async function bringIntoView(page: Page, selector: string, idOf: (el: Element) => string): Promise<string> {
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(600);
  const id = await page.locator(selector).first().evaluate(idOf);
  await page.locator(selector).first().click({ position: { x: 8, y: 8 } });
  await page.keyboard.press('Shift+Digit2');
  await page.waitForTimeout(400);
  await page.keyboard.press('Minus');
  await page.waitForTimeout(600);
  return id;
}

async function boxOf(page: Page, id: string): Promise<Box> {
  return (await page.locator(nodeSel(id)).boundingBox())!;
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

async function newNode(page: Page, before: Set<string>): Promise<string> {
  await expect.poll(async () => (await page.locator('.svelte-flow__node[data-id]').evaluateAll((all) => all.map((e) => (e as HTMLElement).dataset.id!))).some((id) => !before.has(id)), { timeout: OPEN_MS }).toBe(true);
  const all = await page.locator('.svelte-flow__node[data-id]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id!));
  return all.find((id) => !before.has(id))!;
}

const domIds = async (page: Page) => new Set(await page.locator('.svelte-flow__node[data-id]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id!)));

async function openFill(page: Page) {
  if (await fillHex(page).isVisible()) {
    return;
  }
  await page.getByTestId('motion-inspector').getByTestId('fill-stack').first().getByTestId('fill-swatch').first().click();
  await expect(fillHex(page)).toBeVisible({ timeout: OPEN_MS });
}

const FILL_WATCH: Watch = { id: 'fill hex', selector: '[data-testid="fill-editor"] input.hex', read: Read.Value };
const ROTATE_WATCH: Watch = { id: 'rotate', selector: 'aside.props input.num[aria-label="Rotate"]', read: Read.Value };
const OPACITY_WATCH: Watch = { id: 'opacity', selector: 'aside.props input.num[aria-label="Opacity"]', read: Read.Value };
const FRAME_FILL_WATCH: Watch = { ...FILL_WATCH, id: 'frame fill' };
const TEXT_WATCHES: Watch[] = [
  { id: 'text', selector: 'aside.props textarea', read: Read.Value },
  { id: 'size', selector: 'aside.props [data-field="Size"] input', read: Read.Value }
];
const promptWatch = (id: string): Watch => ({ id: 'prompt', selector: `${nodeSel(id)} textarea`, read: Read.Value });
const boxWatch = (id: string, key = id): Watch => ({ id: `${key} box`, selector: nodeSel(id), read: Read.Box });
const pixel = async (page: Page, id: string): Promise<PixelWatch> => ({ id, box: await boxOf(page, id), touched: true });

const STEPS: Step[] = [
  {
    name: 'insert a box',
    drive: async ({ page, ids }) => {
      const before = await domIds(page);
      const spot = await emptySpot(page);
      await pickBarTool(page, 'rectangle');
      await drag(page, { x: spot.x + 20, y: spot.y + 20 }, { x: spot.x + 180, y: spot.y + 120 });
      const id = await newNode(page, before);
      ids.set('box', id);
      await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: OPEN_MS });
      return { touched: [id] };
    }
  },
  {
    name: 'recolour 5× quickly',
    drive: async ({ page, ids, watch }) => {
      const id = ids.get('box')!;
      await openFill(page);
      await watch([FILL_WATCH]);
      for (const colour of COLOURS) {
        await fillHex(page).fill(colour);
        await fillHex(page).press('Enter');
        await page.waitForTimeout(150);
      }
      return { touched: [id], watches: [FILL_WATCH], pixels: [await pixel(page, id)], expected: [{ id: 'fill hex', value: COLOURS.at(-1)!.slice(1) }] };
    }
  },
  {
    name: 'move 5×',
    drive: async ({ page, ids, watch }) => {
      const id = ids.get('box')!;
      await watch([boxWatch(id, 'box')]);
      await leaveEditor(page);
      await page.locator(nodeSel(id)).click({ position: { x: 6, y: 6 } });
      for (let i = 0; i < 5; i++) {
        const b = await boxOf(page, id);
        await drag(page, { x: b.x + b.width / 2, y: b.y + b.height / 2 }, { x: b.x + b.width / 2 - MOVE_PX, y: b.y + b.height / 2 + (i % 2 ? -MOVE_PX : MOVE_PX) / 2 }, 6);
      }
      return { touched: [id], watches: [boxWatch(id, 'box')] };
    }
  },
  {
    name: 'resize',
    drive: async ({ page, ids, watch }) => {
      const id = ids.get('box')!;
      await watch([boxWatch(id, 'box')]);
      const handle = page.locator(`${nodeSel(id)} .svelte-flow__resize-control.handle.bottom.right, .svelte-flow__resize-control.handle.bottom.right`).first();
      await expect(handle).toBeVisible({ timeout: 5000 });
      const h = (await handle.boundingBox())!;
      await drag(page, { x: h.x + h.width / 2, y: h.y + h.height / 2 }, { x: h.x + 60, y: h.y + 40 });
      return { touched: [id], watches: [boxWatch(id, 'box')] };
    }
  },
  {
    name: 'rotate',
    drive: async ({ page, ids }) => {
      const id = ids.get('box')!;
      const handle = page.getByTestId('rotate-handle').first();
      if (await handle.isVisible()) {
        const h = (await handle.boundingBox())!;
        const b = await boxOf(page, id);
        await drag(page, { x: h.x + h.width / 2, y: h.y + h.height / 2 }, { x: b.x + b.width + 60, y: b.y + b.height / 2 }, 10);
        return { touched: [id] };
      }
      const rotate = page.locator('aside.props input.num[aria-label="Rotate"]').first();
      await rotate.fill('15');
      await rotate.press('Enter');
      return { touched: [id], watches: [ROTATE_WATCH], expected: [{ id: 'rotate', value: '15' }] };
    }
  },
  {
    name: 'duplicate with ⌥-drag',
    drive: async ({ page, ids, watch }) => {
      const id = ids.get('box')!;
      await watch([boxWatch(id, 'box')]);
      await leaveEditor(page);
      await clickEmpty(page);
      const before = await domIds(page);
      const b = await boxOf(page, id);
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await page.keyboard.down('Alt');
      await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2 + 40, b.y + b.height / 2 + b.height + 60, { steps: 10 });
      await page.mouse.up();
      await page.keyboard.up('Alt');
      const copy = await newNode(page, before);
      ids.set('copy', copy);
      return { touched: [id, copy], watches: [boxWatch(id, 'box')] };
    }
  },
  {
    name: 'align with ⌥ keys',
    drive: async ({ page, ids, watch }) => {
      const [a, b] = [ids.get('box')!, ids.get('copy')!];
      await watch([boxWatch(a, 'box'), boxWatch(b, 'copy')]);
      await leaveEditor(page);
      await clickEmpty(page);
      await page.locator(nodeSel(a)).click({ position: { x: 6, y: 6 } });
      await page.locator(nodeSel(b)).click({ position: { x: 6, y: 6 }, modifiers: ['Shift'] });
      await page.keyboard.press('Alt+KeyA');
      await page.waitForTimeout(300);
      await page.keyboard.press('Alt+KeyH');
      return { touched: [a, b], watches: [boxWatch(a, 'box'), boxWatch(b, 'copy')] };
    }
  },
  {
    name: 'group ⌘G',
    drive: async ({ page, ids }) => {
      const before = await domIds(page);
      await page.keyboard.press('ControlOrMeta+g');
      const group = await newNode(page, before);
      ids.set('group', group);
      return { touched: [ids.get('box')!, ids.get('copy')!, group] };
    }
  },
  {
    name: 'change a prop on the group',
    drive: async ({ page, ids, watch }) => {
      const opacity = page.locator('aside.props input.num[aria-label="Opacity"]').first();
      await expect(opacity).toBeVisible({ timeout: 5000 });
      await watch([OPACITY_WATCH]);
      await opacity.fill('60');
      await opacity.press('Enter');
      return { touched: [ids.get('box')!, ids.get('copy')!, ids.get('group')!], watches: [OPACITY_WATCH], expected: [{ id: 'opacity', value: '60' }] };
    }
  },
  {
    name: 'undo / redo',
    drive: async ({ page, ids }) => {
      await page.keyboard.press('ControlOrMeta+z');
      await page.waitForTimeout(400);
      await page.keyboard.press('ControlOrMeta+Shift+z');
      return { touched: [ids.get('box')!, ids.get('copy')!, ids.get('group')!] };
    }
  },
  {
    name: 'add text, type, size, font',
    drive: async ({ page, ids, watch }) => {
      await leaveEditor(page);
      await clickEmpty(page);
      const before = await domIds(page);
      const spot = await emptySpot(page, { width: 200, height: 90 });
      await pickBarTool(page, 'text');
      await page.mouse.click(spot.x + 40, spot.y + 40);
      const id = await newNode(page, before);
      ids.set('text', id);
      await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: OPEN_MS });
      await expect(page.locator('aside.props textarea').first()).toBeFocused({ timeout: OPEN_MS });
      await watch(TEXT_WATCHES);
      await page.keyboard.type(TYPED, { delay: 40 });
      const size = page.locator('aside.props [data-field="Size"] input').first();
      await size.fill('72');
      await size.press('Enter');
      await page.getByTestId('font-picker').first().click().catch(() => undefined);
      const font = page.getByTestId('font-results').locator('li, button').nth(2);
      if (await font.isVisible().catch(() => false)) {
        await font.click();
      }
      return {
        touched: [id],
        watches: TEXT_WATCHES,
        expected: [{ id: 'text', value: TYPED }, { id: 'size', value: '72' }]
      };
    }
  },
  {
    name: 'open a frame, edit fill and position, close',
    drive: async ({ page, ids }) => {
      await leaveEditor(page);
      await clickEmpty(page);
      const id = await bringIntoView(page, FRAME_NODE, (e) => (e as HTMLElement).dataset.motionNode!);
      ids.set('frame', id);
      const stage = page.locator(`[data-motion-node="${id}"]`).first();
      await stage.dblclick();
      await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: OPEN_MS });
      const layers = page.getByTestId('layers');
      if (!(await layers.isVisible().catch(() => false))) {
        await page.getByRole('button', { name: 'Layers', exact: true }).click().catch(() => undefined);
      }
      await layers.locator('[data-layer]').first().click();
      await openFill(page);
      await fillHex(page).fill('14b8a6');
      await fillHex(page).press('Enter');
      const x = page.locator('aside.props input.num[aria-label="X"]').first();
      if (await x.isVisible().catch(() => false)) {
        await x.fill(String(Number((await x.inputValue()) || 0) + 12));
        await x.press('Enter');
      }
      await leaveEditor(page);
      await clickEmpty(page);
      return { touched: [id], pixels: [await pixel(page, id)] };
    }
  },
  {
    name: 'reopen the frame',
    drive: async ({ page, ids, watch }) => {
      const id = ids.get('frame')!;
      await watch([FRAME_FILL_WATCH]);
      await page.locator(`[data-motion-node="${id}"]`).first().dblclick();
      await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: OPEN_MS });
      await openFill(page).catch(() => undefined);
      const expected = (await fillHex(page).isVisible().catch(() => false)) ? [{ id: 'frame fill', value: '14b8a6' }] : [];
      return { touched: [id], watches: [FRAME_FILL_WATCH], expected, pixels: [await pixel(page, id)] };
    }
  },
  {
    name: 'pan / zoom across the canvas',
    drive: async ({ page }) => {
      await leaveEditor(page);
      await clickEmpty(page);
      const pane = (await page.locator(SURFACE).first().boundingBox())!;
      await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
      for (let i = 0; i < 60; i++) {
        await page.mouse.wheel(Math.sin(i / 8) * 60, Math.cos(i / 10) * 40);
      }
      await page.keyboard.down('Control');
      for (let i = 0; i < 20; i++) {
        await page.mouse.wheel(0, i < 10 ? 20 : -20);
      }
      await page.keyboard.up('Control');
      return { touched: [] };
    }
  },
  {
    name: 'edit a generate prompt and Generate (mocked)',
    drive: async ({ page, ids, watch }) => {
      const id = await bringIntoView(page, GEN_NODE, (e) => (e as HTMLElement).dataset.id!);
      ids.set('gen', id);
      const prompt = page.locator(`${nodeSel(id)} textarea`).first();
      await expect(prompt).toBeVisible({ timeout: OPEN_MS });
      await watch([promptWatch(id)]);
      await prompt.fill(PROMPT);
      await page.locator(nodeSel(id)).getByRole('button', { name: /generate/i }).first().click();
      return { touched: [id], watches: [promptWatch(id)], expected: [{ id: 'prompt', value: PROMPT }] };
    }
  },
  {
    name: 'select another node, then back',
    drive: async ({ page, ids, watch }) => {
      const gen = ids.get('gen')!;
      await watch([promptWatch(gen)]);
      const other = await page.locator('.svelte-flow__node[data-id]').evaluateAll(
        (all, skip) => all.map((e) => ({ id: (e as HTMLElement).dataset.id!, r: e.getBoundingClientRect() })).find(({ id, r }) => id !== skip && r.width > 40 && r.x > 50 && r.y > 60 && r.x + 20 < innerWidth - 400 && r.y + 20 < innerHeight - 100),
        gen
      );
      if (!other) {
        throw new Error('no other node in view');
      }
      await page.mouse.click(other.r.x + 8, other.r.y + 8);
      await page.waitForTimeout(300);
      await page.locator(nodeSel(gen)).click({ position: { x: 20, y: 10 } });
      return { touched: [gen, other.id], watches: [promptWatch(gen)], expected: [{ id: 'prompt', value: PROMPT }] };
    }
  }
];

enum Variant {
  Session = 'session',
  TwoTabs = 'two-tabs'
}

const VARIANTS = (process.env.FLUID_VARIANTS ?? `${Variant.Session},${Variant.TwoTabs}`).split(',') as Variant[];
const PEER_EVERY_MS = 1500;
const ACCOUNT = () => ({ email: process.env.E2E_TEST_EMAIL!, password: process.env.E2E_TEST_PASSWORD! });

async function startPeer(peer: BrowserContext, path: string): Promise<() => Promise<void>> {
  const page = await peer.newPage();
  await mockGenerate(page);
  await signInE2e(page, ACCOUNT());
  await page.goto(path, { waitUntil: 'load' });
  await expect(page.locator(SURFACE).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(4000);
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(600);
  const target = page.locator(GEN_NODE).last();
  const id = await target.evaluate((e) => (e as HTMLElement).dataset.id!);
  await target.click({ position: { x: 8, y: 8 } });
  await page.keyboard.press('Shift+Digit2');
  const prompt = page.locator(`${nodeSel(id)} textarea`).first();
  let on = true;
  const loop = (async () => {
    for (let i = 0; on; i++) {
      await prompt.fill(`peer edit ${i}`).catch(() => undefined);
      await page.waitForTimeout(PEER_EVERY_MS);
    }
  })();
  return async () => {
    on = false;
    await loop;
  };
}

async function mockGenerate(page: Page): Promise<string[]> {
  const seen: string[] = [];
  await page.route(/\/api\/v1\/org\/nodes\/[^/]+\/generate$|\?\/run$|\/prompts\/enhance$|\/agent$/, (route) => {
    if (route.request().method() !== 'POST') {
      return route.fallback();
    }
    seen.push(route.request().url());
    return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'mocked in the fluidity scorecard' }) });
  });
  return seen;
}

async function untouchedWatches(page: Page, probe: FluidProbe, touched: Set<string>): Promise<PixelWatch[]> {
  const boxes = await probe.nodeBoxes();
  return boxes
    .filter((b) => !touched.has(b.id) && b.width > 80 && b.height > 60 && b.x > 0 && b.y > 60 && b.x + b.width < VIEWPORT.width - 360 && b.y + b.height < VIEWPORT.height - 80)
    .slice(0, UNTOUCHED_SAMPLES)
    .map((b) => ({ id: b.id.slice(0, 8), box: b, touched: false }));
}

async function runSession(page: Page, path: string): Promise<StepRun[]> {
  await page.goto(path, { waitUntil: 'load' });
  await expect(page.locator(SURFACE).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(6000);
  page.setDefaultTimeout(OPEN_MS);
  await page.locator(SURFACE).first().click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Shift+Digit0');
  await page.keyboard.press('Minus');
  await page.keyboard.press('Minus');
  await page.waitForTimeout(1500);
  const probe = new FluidProbe(page);
  await probe.attach();
  const ids = new Map<string, string>();
  const runs: StepRun[] = [];

  for (const step of STEPS) {
    const everTouched = new Set(ids.values());
    const camera = step.name.startsWith('pan');
    const background = camera ? [] : await untouchedWatches(page, probe, everTouched);
    const began = Date.now();
    await probe.start([]);
    let outcome: Outcome | null = null;
    let error: string | null = null;
    try {
      outcome = await Promise.race([step.drive({ page, ids, watch: (w) => probe.watch(w) }), new Promise<never>((_, no) => setTimeout(() => no(new Error(`step over ${STEP_MS} ms`)), STEP_MS))]);
      await page.waitForTimeout(SETTLE_MS);
    } catch (err) {
      error = String(err).replace(/\x1b\[[0-9;]*m/g, '').split('\n').slice(0, 3).join(' ').slice(0, 240);
      await page.screenshot({ path: join(OUT, 'raw', `undriven-${STEPS.indexOf(step)}.png`) }).catch(() => undefined);
    }
    const touched = new Set((outcome?.touched ?? []).filter(Boolean));
    const stillUntouched = background.filter((w) => ![...touched].some((id) => id.startsWith(w.id)));
    const { facts } = await probe.stop(touched, camera ? [] : [...(outcome?.pixels ?? []), ...stillUntouched]);
    const finalChecks: string[] = [];
    for (const e of outcome?.expected ?? []) {
      const w = outcome!.watches!.find((x) => x.id === e.id)!;
      const shown = await page.locator(w.selector).first().inputValue().catch(() => '∅');
      if (!shown.toLowerCase().includes(e.value.toLowerCase())) {
        finalChecks.push(`${e.id}: shows "${shown}", last set "${e.value}"`);
      }
    }
    runs.push({ name: step.name, facts, error, finalChecks });
    console.log(`[fluid] ${step.name} ${Date.now() - began}ms ${error ? `UNDRIVEN ${error}` : JSON.stringify(facts)}`);
  }
  return runs;
}

function writeRun(run: SessionRun) {
  mkdirSync(join(OUT, 'runs'), { recursive: true });
  writeFileSync(join(OUT, 'runs', `${run.browser}-${run.renderer}-${run.variant}.json`), JSON.stringify(run, null, 2));
  const all = readdirSync(join(OUT, 'runs')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(OUT, 'runs', f), 'utf8')) as SessionRun);
  writeFileSync(join(OUT, 'SCORECARD.md'), scorecard(all));
}

async function recordedContext(browser: Browser, name: string): Promise<BrowserContext> {
  mkdirSync(join(OUT, 'raw', name), { recursive: true });
  return browser.newContext({ viewport: VIEWPORT, recordVideo: { dir: join(OUT, 'raw', name), size: VIEWPORT } });
}

async function saveVideo(page: Page, name: string) {
  const webm = await page.video()?.path();
  if (!webm || !existsSync(webm)) {
    return;
  }
  const mp4 = join(OUT, `${name}.mp4`);
  try {
    execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', webm, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  } catch {
    renameSync(webm, join(OUT, `${name}.webm`));
  }
}

async function cleanup(db: SupabaseClient, canvasId: string, before: Set<string>) {
  const after = await liveNodeIds(db, canvasId);
  const created = [...after].filter((id) => !before.has(id));
  if (created.length) {
    await db.from('nodes').update({ deleted_at: new Date().toISOString() }).in('id', created);
  }
}

test.describe('fluidity scorecard @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(600_000);

  for (const variant of VARIANTS) {
    for (const renderer of RENDERERS) {
      test(`${variant} on the heavy canvas, ${renderer} renderer`, async ({ browser, browserName }) => {
        const { db } = await testAccount();
        const { projectId, canvasId } = await fixtureCanvas(db);
        const before = await liveNodeIds(db, canvasId);
        const name = `${browserName}-${renderer}-${variant}`;
        const path = `/p/${projectId}/c/${canvasId}${renderer === 'dom' ? '?renderer=dom' : ''}`;
        const context = await recordedContext(browser, name);
        const page = await context.newPage();
        page.setDefaultTimeout(60_000);
        const mocked = await mockGenerate(page);
        const peer = variant === Variant.TwoTabs ? await browser.newContext({ viewport: VIEWPORT }) : null;
        let runs: StepRun[] = [];
        try {
          await signInE2e(page, ACCOUNT());
          const stopPeer = peer ? await startPeer(peer, path) : () => Promise.resolve();
          runs = await runSession(page, path);
          await stopPeer();
        } finally {
          await peer?.close();
          await context.close();
          await saveVideo(page, name);
          await cleanup(db, canvasId, before);
        }
        writeRun({ browser: browserName, renderer, variant, steps: runs, mockedCalls: mocked.length, at: new Date().toISOString() });
        expect(verdictOf(runs, browserName), 'fluidity thresholds').toEqual([]);
      });
    }
  }

});
