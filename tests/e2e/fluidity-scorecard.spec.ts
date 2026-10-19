import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { REAL_STACK, signInE2e } from './fixtures/session';
import { pickBarTool } from './fixtures/canvas-bar';
import { FluidProbe, Read, type Box, type PixelWatch, type Watch } from './fixtures/fluidity-probe';
import { recordsVideo, scorecard, verdictOf, type SessionRun, type StepResult } from './fixtures/fluidity-report';

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
const ROTATION = 15;
const TEXT_SIZE = '72';
const FRAME_FILL = '14b8a6';
const PROMPT = 'Moody product shot, rim light';
const TYPED = 'Fluid';

type Ctx = { page: Page; ids: Map<string, string>; watch: (w: Watch[]) => Promise<void> };
type Outcome = { touched: string[]; watches?: Watch[]; pixels?: PixelWatch[]; expected?: { id: string; value: string }[] };
type Step = { name: string; drive: (c: Ctx) => Promise<Outcome> };
type StepRun = StepResult;

const nodeSel = (id: string) => `.svelte-flow__node[data-id="${id}"]`;
const contentSel = (id: string) => `[data-id="${id}"]`;
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
    await page.locator('body').evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
  await expect(page.getByTestId('motion-editor')).toHaveCount(0, { timeout: OPEN_MS });
}

const GEN_NODE = [...['text', 'image', 'video'].map((t) => `.svelte-flow__node[data-kind="${t}"]`), '.svelte-flow__node-tile:has(.gen)'].join(', ');
const FRAME_NODE = '[data-motion-node]:not([data-kind="element"])';

enum Open {
  Single = 'single',
  Double = 'double'
}

const centre = (b: Box) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
const MARQUEE_PAD = 3;
const IN_VIEW = { left: 60, top: 70, right: 420, bottom: 110 };

function visible(b: Box | null): boolean {
  return !!b && b.width > 8 && b.x > IN_VIEW.left && b.y > IN_VIEW.top && b.x + b.width < VIEWPORT.width - IN_VIEW.right && b.y + b.height < VIEWPORT.height - IN_VIEW.bottom;
}

const WHEEL_ZOOM = 0.01;
const ZOOM_TRIES = 4;
const FILL_SHARE = 0.5;

async function inView(page: Page, id: string): Promise<Box> {
  const now = await page.locator(nodeSel(id)).boundingBox({ timeout: 1000 }).catch(() => null);
  if (visible(now)) {
    return now!;
  }
  await leaveEditor(page);
  await zoomOnto(page, id);
  return (await page.locator(nodeSel(id)).boundingBox())!;
}

async function zoomOnto(page: Page, id: string) {
  const area = { width: VIEWPORT.width - IN_VIEW.left - IN_VIEW.right, height: VIEWPORT.height - IN_VIEW.top - IN_VIEW.bottom };
  const goal = { x: IN_VIEW.left + area.width / 2, y: IN_VIEW.top + area.height / 2 };
  for (let i = 0; i < ZOOM_TRIES; i++) {
    const b = (await page.locator(nodeSel(id)).boundingBox())!;
    if (visible(b) && b.width > area.width * FILL_SHARE * 0.5) {
      return;
    }
    const at = centre(b);
    await page.mouse.move(goal.x, goal.y);
    await page.mouse.wheel(at.x - goal.x, at.y - goal.y);
    await page.waitForTimeout(120);
    const scale = Math.min((area.width * FILL_SHARE) / b.width, (area.height * FILL_SHARE) / b.height);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -Math.log(scale) / WHEEL_ZOOM);
    await page.keyboard.up('Control');
    await page.waitForTimeout(200);
  }
}

const USER_HOVER_MS = 300;
let hoverBeforeOpen = 0;

async function approach(page: Page, at: { x: number; y: number }) {
  if (!hoverBeforeOpen) {
    return;
  }
  await page.mouse.move(at.x, at.y, { steps: 4 });
  await page.waitForTimeout(hoverBeforeOpen);
}

async function editingInPlace(page: Page) {
  await expect
    .poll(async () => (await Promise.all(page.frames().map((f) => f.locator('[contenteditable]').count().catch(() => 0)))).some(Boolean), { timeout: OPEN_MS })
    .toBe(true);
}

async function clickNode(page: Page, id: string) {
  const b = await inView(page, id);
  await approach(page, { x: b.x + Math.min(20, b.width / 4), y: b.y + Math.min(12, b.height / 4) });
  await page.mouse.click(b.x + Math.min(20, b.width / 4), b.y + Math.min(12, b.height / 4));
}

async function openNode(page: Page, id: string, how = Open.Single) {
  if (await page.getByTestId('motion-editor').count()) {
    return;
  }
  const at = centre(await inView(page, id));
  await approach(page, at);
  await (how === Open.Double ? page.mouse.dblclick(at.x, at.y) : page.mouse.click(at.x, at.y));
  await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: OPEN_MS });
}

const CLIP_ROW = '.row.layer[data-layer]';

async function pickFilledLayer(page: Page, only?: string): Promise<string> {
  const rows = page.getByTestId('motion-editor').locator(CLIP_ROW);
  const swatch = page.getByTestId('motion-inspector').getByTestId('fill-swatch').first();
  if (only) {
    await rows.and(page.locator(`[data-layer="${only}"]`)).first().locator('.head .layer-name').click();
    await expect(swatch).toBeVisible({ timeout: OPEN_MS });
    return only;
  }
  const count = await rows.count();
  for (let i = count - 1; i >= 0; i--) {
    const row = rows.nth(i);
    await row.locator('.head .layer-name').click();
    if (await swatch.isVisible({ timeout: 500 }).catch(() => false)) {
      return (await row.getAttribute('data-layer'))!;
    }
  }
  throw new Error('no layer with a fill in this frame');
}

async function marquee(page: Page, ids: string[]) {
  await inView(page, ids[0]);
  const boxes = await Promise.all(ids.map((id) => boxOf(page, id)));
  const left = Math.min(...boxes.map((b) => b.x)) - 16;
  const top = Math.min(...boxes.map((b) => b.y)) - 16;
  const right = Math.max(...boxes.map((b) => b.x + b.width)) + 16;
  const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + 16;
  await drag(page, { x: left, y: top }, { x: right, y: bottom }, 8);
}

const FRAME_TRIES = 6;

async function frameWithFill(page: Page): Promise<{ id: string; layer: string }> {
  const frames = await page.locator(FRAME_NODE).evaluateAll((all) => all.map((e) => (e as HTMLElement).dataset.motionNode!).filter((id) => document.querySelector(`.svelte-flow__node[data-id="${id}"]`)));
  for (const id of frames.filter((f) => !createdHere.has(f)).slice(0, FRAME_TRIES)) {
    const opened = await openNode(page, id, Open.Double).then(() => true, () => false);
    if (!opened) {
      continue;
    }
    const layer = await pickFilledLayer(page).catch(() => null);
    if (layer) {
      return { id, layer };
    }
    await leaveEditor(page);
  }
  throw new Error(`none of the first ${FRAME_TRIES} frames has a layer with a fill`);
}

async function anyInView(page: Page, selector: string, idOf: (el: Element) => string): Promise<string> {
  const id = await page.locator(selector).first().evaluate(idOf);
  await inView(page, id);
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

const createdHere = new Set<string>();

async function newNode(page: Page, before: Set<string>): Promise<string> {
  await expect.poll(async () => (await page.locator('.svelte-flow__node[data-id]').evaluateAll((all) => all.map((e) => (e as HTMLElement).dataset.id!))).some((id) => !before.has(id)), { timeout: OPEN_MS }).toBe(true);
  const all = await page.locator('.svelte-flow__node[data-id]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.id!));
  const id = all.find((id) => !before.has(id))!;
  createdHere.add(id);
  return id;
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
const ROTATE_WATCH: Watch = { id: 'rotate', selector: 'aside.props input.num[aria-label="Rotate Z"]', read: Read.Value };
const WIDTH_WATCH: Watch = { id: 'width', selector: 'aside.props input.num[aria-label="Width"]', read: Read.Value };
const RESIZE_BY = 60;
const FRAME_FILL_WATCH: Watch = { ...FILL_WATCH, id: 'frame fill' };
const TEXT_WATCHES: Watch[] = [
  { id: 'text', selector: 'aside.props textarea', read: Read.Value },
  { id: 'size', selector: 'aside.props [data-field="Size"] input', read: Read.Value }
];
const promptWatch = (id: string): Watch => ({ id: 'prompt', selector: `${contentSel(id)} textarea`, read: Read.Value });
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
      await leaveEditor(page);
      await inView(page, id);
      await watch([boxWatch(id, 'box')]);
      for (let i = 0; i < 5; i++) {
        const b = await boxOf(page, id);
        await drag(page, centre(b), { x: b.x + b.width / 2 - MOVE_PX, y: b.y + b.height / 2 + MOVE_PX / 2 }, 6);
      }
      return { touched: [id], watches: [boxWatch(id, 'box')] };
    }
  },
  {
    name: 'resize',
    drive: async ({ page, ids, watch }) => {
      const id = ids.get('box')!;
      await openNode(page, id);
      await watch([boxWatch(id, 'box')]);
      const handle = page.locator('.svelte-flow__resize-control.handle.bottom.right').first();
      if (await handle.isVisible({ timeout: 2000 }).catch(() => false)) {
        const h = (await handle.boundingBox())!;
        await drag(page, centre(h), { x: h.x + 60, y: h.y + 40 });
        return { touched: [id], watches: [boxWatch(id, 'box')] };
      }
      const width = page.locator(WIDTH_WATCH.selector).first();
      const wider = String(Number(await width.inputValue()) + RESIZE_BY);
      await watch([WIDTH_WATCH]);
      await width.fill(wider);
      await width.press('Enter');
      return { touched: [id], watches: [boxWatch(id, 'box'), WIDTH_WATCH], expected: [{ id: 'width', value: wider }] };
    }
  },
  {
    name: 'rotate',
    drive: async ({ page, ids, watch }) => {
      const id = ids.get('box')!;
      await openNode(page, id);
      await watch([ROTATE_WATCH]);
      const rotate = page.locator(ROTATE_WATCH.selector).first();
      await rotate.fill(String(ROTATION));
      await rotate.press('Enter');
      return { touched: [id], watches: [ROTATE_WATCH], expected: [{ id: 'rotate', value: String(ROTATION) }] };
    }
  },
  {
    name: 'duplicate with ⌥-drag',
    drive: async ({ page, ids, watch }) => {
      const id = ids.get('box')!;
      await leaveEditor(page);
      await inView(page, id);
      await watch([boxWatch(id, 'box')]);
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
      await leaveEditor(page);
      await marquee(page, [a, b]);
      await watch([boxWatch(a, 'box'), boxWatch(b, 'copy')]);
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
      const group = ids.get('group')!;
      await leaveEditor(page);
      await marquee(page, [group]);
      const g = await boxOf(page, group);
      await watch([boxWatch(group, 'group')]);
      const handle = page.getByTestId('rotate-handle').first();
      await expect(handle).toBeVisible({ timeout: 5000 });
      const h = (await handle.boundingBox())!;
      await drag(page, centre(h), { x: g.x + g.width + 80, y: g.y + g.height / 2 }, 10);
      return { touched: [ids.get('box')!, ids.get('copy')!, group], watches: [boxWatch(group, 'group')] };
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
      await drag(page, { x: spot.x + 20, y: spot.y + 20 }, { x: spot.x + spot.width - 20, y: spot.y + spot.height - 20 }, 4);
      const id = await newNode(page, before);
      ids.set('text', id);
      await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: OPEN_MS });
      await editingInPlace(page);
      await watch(TEXT_WATCHES);
      await page.keyboard.type(TYPED, { delay: 40 });
      const size = page.locator(TEXT_WATCHES[1].selector).first();
      await size.fill(TEXT_SIZE);
      await size.press('Enter');
      return { touched: [id], watches: TEXT_WATCHES, expected: [{ id: 'text', value: TYPED }, { id: 'size', value: TEXT_SIZE }] };
    }
  },
  {
    name: 'open a frame, edit fill and position, close',
    drive: async ({ page, ids }) => {
      await leaveEditor(page);
      const { id, layer } = await frameWithFill(page);
      ids.set('frame', id);
      ids.set('frameLayer', layer);
      await openFill(page);
      await fillHex(page).fill(FRAME_FILL);
      await fillHex(page).press('Enter');
      const x = page.locator('aside.props input.num[aria-label="X"]').first();
      await x.fill(String(Number((await x.inputValue()) || 0) + 12));
      await x.press('Enter');
      await leaveEditor(page);
      return { touched: [id], pixels: [await pixel(page, id)] };
    }
  },
  {
    name: 'reopen the frame',
    drive: async ({ page, ids, watch }) => {
      const id = ids.get('frame')!;
      await watch([FRAME_FILL_WATCH]);
      await openNode(page, id, Open.Double);
      await pickFilledLayer(page, ids.get('frameLayer'));
      await openFill(page);
      return { touched: [id], watches: [FRAME_FILL_WATCH], expected: [{ id: 'frame fill', value: FRAME_FILL }], pixels: [await pixel(page, id)] };
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
      const id = await anyInView(page, GEN_NODE, (e) => (e as HTMLElement).dataset.id!);
      ids.set('gen', id);
      await clickNode(page, id);
      const prompt = page.locator(`${contentSel(id)} textarea`).first();
      await expect(prompt).toBeVisible({ timeout: OPEN_MS });
      await watch([promptWatch(id)]);
      await prompt.fill(PROMPT);
      const run = page.locator(contentSel(id)).getByRole('button', { name: /^(generate|redo)/i }).first();
      if (!(await run.isEnabled())) {
        throw new Error('Generate is disabled on this node');
      }
      await run.click();
      return { touched: [id], watches: [promptWatch(id)], expected: [{ id: 'prompt', value: PROMPT }] };
    }
  },
  {
    name: 'select another node, then back',
    drive: async ({ page, ids, watch }) => {
      const gen = ids.get('gen')!;
      await watch([promptWatch(gen)]);
      const other = await page.locator('.svelte-flow__node[data-id]').evaluateAll(
        (all, skip) => all.map((e) => ({ id: (e as HTMLElement).dataset.id!, r: e.getBoundingClientRect() })).find(({ id, r }) => id !== skip && r.width > 40 && r.x > 60 && r.y > 70 && r.x + 20 < innerWidth - 420 && r.y + 20 < innerHeight - 110),
        gen
      );
      if (!other) {
        throw new Error('no other node in view');
      }
      await page.mouse.click(other.r.x + 8, other.r.y + 8);
      await page.waitForTimeout(300);
      await leaveEditor(page);
      await clickNode(page, gen);
      return { touched: [gen, other.id], watches: [promptWatch(gen)], expected: [{ id: 'prompt', value: PROMPT }] };
    }
  }
];

enum Variant {
  Session = 'session',
  TwoTabs = 'two-tabs',
  User = 'user'
}

const HOVER_OF: Record<Variant, number> = { [Variant.Session]: 0, [Variant.TwoTabs]: 0, [Variant.User]: USER_HOVER_MS };

const VARIANTS = (process.env.FLUID_VARIANTS ?? `${Variant.Session},${Variant.TwoTabs},${Variant.User}`).split(',') as Variant[];
const PEER_EVERY_MS = 1500;
const ACCOUNT = () => ({ email: process.env.E2E_TEST_EMAIL!, password: process.env.E2E_TEST_PASSWORD! });

async function startPeer(peer: BrowserContext, path: string): Promise<() => Promise<void>> {
  const page = await peer.newPage();
  await mockGenerate(page);
  await signInE2e(page, ACCOUNT());
  await page.goto(path, { waitUntil: 'load' });
  await expect(page.locator(SURFACE).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(4000);
  const target = page.locator(GEN_NODE).last();
  const id = await target.evaluate((e) => (e as HTMLElement).dataset.id!);
  await zoomOnto(page, id);
  const prompt = page.locator(`${contentSel(id)} textarea`).first();
  let on = true;
  const loop = (async () => {
    for (let i = 0; on; i++) {
      await prompt.fill(`peer edit ${i}`).catch(() => undefined);
      await page.waitForTimeout(PEER_EVERY_MS).catch(() => undefined);
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

type Persisted = { what: string; node: string; open: (page: Page, id: string, ids: Map<string, string>) => Promise<void>; selector: string; value: string };

const PERSISTED: Persisted[] = [
  { what: 'text', node: 'text', open: (page, id) => openNode(page, id), selector: TEXT_WATCHES[0].selector, value: TYPED },
  { what: 'text size', node: 'text', open: (page, id) => openNode(page, id), selector: TEXT_WATCHES[1].selector, value: TEXT_SIZE },
  { what: 'frame fill', node: 'frame', open: async (page, id, ids) => { await openNode(page, id, Open.Double); await pickFilledLayer(page, ids.get('frameLayer')); await openFill(page); }, selector: FILL_WATCH.selector, value: FRAME_FILL },
  { what: 'prompt', node: 'gen', open: (page, id) => clickNode(page, id), selector: '', value: PROMPT }
];

async function afterReload(page: Page, ids: Map<string, string>): Promise<StepRun> {
  const checks: string[] = [];
  let error: string | null = null;
  await page.reload({ waitUntil: 'load' });
  await expect(page.locator(SURFACE).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(6000);
  const probe = new FluidProbe(page);
  await probe.attach();
  await probe.start([]);
  for (const p of PERSISTED) {
    const id = ids.get(p.node);
    if (!id) {
      error = `${p.what}: its node was never made`;
      continue;
    }
    try {
      await leaveEditor(page);
      await p.open(page, id, ids);
      const shown = await page.locator(p.selector || `${contentSel(id)} textarea`).first().inputValue();
      if (!shown.toLowerCase().includes(p.value.toLowerCase())) {
        checks.push(`after reload: ${p.what} shows "${shown}", last set "${p.value}"`);
      }
    } catch (err) {
      error = `${p.what}: ${String(err).replace(/\x1b\[[0-9;]*m/g, '').split('\n')[0].slice(0, 160)}`;
    }
  }
  const { facts } = await probe.stop(new Set(ids.values()), []);
  return { name: 'after reload', facts, error, finalChecks: checks };
}

const AWAY_WHEELS = 8;
const AWAY_STEP_PX = 300;

async function awayFromContent(page: Page) {
  const pane = (await page.locator(SURFACE).first().boundingBox())!;
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
  for (let i = 0; i < AWAY_WHEELS; i++) {
    await page.mouse.wheel(-AWAY_STEP_PX, 0);
  }
}

async function runSession(page: Page, path: string): Promise<StepRun[]> {
  await page.goto(path, { waitUntil: 'load' });
  await expect(page.locator(SURFACE).first()).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(6000);
  page.setDefaultTimeout(OPEN_MS);
  await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 2000 }).catch(() => undefined);
  await page.locator(SURFACE).first().click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Shift+Digit0');
  await page.keyboard.press('Minus');
  await page.keyboard.press('Minus');
  await awayFromContent(page);
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
  runs.push(await afterReload(page, ids));
  console.log(`[fluid] after reload ${JSON.stringify(runs.at(-1))}`);
  return runs;
}

function writeRun(run: SessionRun) {
  mkdirSync(join(OUT, 'runs'), { recursive: true });
  writeFileSync(join(OUT, 'runs', `${run.browser}-${run.renderer}-${run.variant}.json`), JSON.stringify(run, null, 2));
  const all = readdirSync(join(OUT, 'runs')).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(OUT, 'runs', f), 'utf8')) as SessionRun);
  writeFileSync(join(OUT, 'SCORECARD.md'), scorecard(all));
}

async function recordedContext(browser: Browser, browserName: string, name: string): Promise<BrowserContext> {
  if (!recordsVideo(browserName)) {
    return browser.newContext({ viewport: VIEWPORT });
  }
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

async function cleanup(db: SupabaseClient, canvasId: string) {
  const created = [...createdHere];
  createdHere.clear();
  if (created.length) {
    await db.from('nodes').update({ deleted_at: new Date().toISOString() }).eq('canvas_id', canvasId).in('id', created);
  }
}

test.describe('fluidity scorecard @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(900_000);

  for (const variant of VARIANTS) {
    for (const renderer of RENDERERS) {
      test(`${variant} on the heavy canvas, ${renderer} renderer`, async ({ browser, browserName }) => {
        const { db } = await testAccount();
        const { projectId, canvasId } = await fixtureCanvas(db);
        const name = `${browserName}-${renderer}-${variant}`;
        const path = `/p/${projectId}/c/${canvasId}${renderer === 'dom' ? '?renderer=dom' : ''}`;
        const context = await recordedContext(browser, browserName, name);
        const page = await context.newPage();
        page.setDefaultTimeout(60_000);
        const mocked = await mockGenerate(page);
        hoverBeforeOpen = HOVER_OF[variant];
        const peer = variant === Variant.TwoTabs ? await browser.newContext({ viewport: VIEWPORT }) : null;
        let runs: StepRun[] = [];
        let stopPeer = () => Promise.resolve();
        try {
          await signInE2e(page, ACCOUNT());
          stopPeer = peer ? await startPeer(peer, path) : stopPeer;
          runs = await runSession(page, path);
        } finally {
          await stopPeer();
          await peer?.close();
          await context.close();
          await saveVideo(page, name);
          await cleanup(db, canvasId);
        }
        writeRun({ browser: browserName, renderer, variant, steps: runs, mockedCalls: mocked.length, at: new Date().toISOString() });
        expect(verdictOf(runs, browserName), 'fluidity thresholds').toEqual([]);
      });
    }
  }

});
