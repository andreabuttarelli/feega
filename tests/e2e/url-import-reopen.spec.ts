import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, gotoHydrated, type E2eSession } from './fixtures/session';

const REAL_STACK = process.env.E2E_REAL_STACK === '1';
const SITE = 'https://vercel.com';
const IMPORT_MS = 300_000;
const WATCH_MS = 12_000;
const SAMPLE_MS = 250;
const ZOOM_AFTER_MS = 300;
const ZOOM_STEP = -240;
const PROBE_MS = 2_000;
const PAINT_MS = 3_000;
const ZOOM_MS = 500;
const LONGEST_TASK_MS = 2_000;
const INK_SHARE = 0.002;
const SEED = process.env.REOPEN_SEED;

test.use({ headless: !process.env.E2E_HEADED, launchOptions: { args: process.env.REOPEN_NO_GPU ? [] : ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

type Seeded = { node: { x: number; y: number; data: Record<string, unknown> }; doc: unknown };
type SeedNode = (seed: { type: string; x?: number; y?: number; data?: Record<string, unknown> }) => Promise<{ id: string }>;

const frameTile = (page: Page) => page.locator('[data-testid="frame-overlays"] [data-frame]').first();

async function canvasOpen(page: Page, session: E2eSession) {
  await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
  await expect(page.locator('[data-canvas-surface]')).toBeVisible({ timeout: 30_000 });
}

async function seeded(admin: SupabaseClient, session: E2eSession, seedNode: SeedNode, file: string) {
  const saved = JSON.parse(readFileSync(file, 'utf8')) as Seeded;
  const frame = await seedNode({ type: 'motion', ...saved.node });
  const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: saved.doc, actor_kind: 'user', actor_id: session.userId });
  expect(error).toBeNull();
}

async function imported(page: Page, admin: SupabaseClient, session: E2eSession) {
  const answer = await page.request.post(`/api/v1/projects/${session.projectId}/url-import`, { data: { canvasId: session.canvasId, url: SITE, x: 0, y: 0 }, timeout: IMPORT_MS });
  expect(answer.ok()).toBe(true);
  const [node] = ((await answer.json()) as { nodes: { id: string; x: number; y: number; data: Record<string, unknown> }[] }).nodes;
  if (!SEED) {
    return;
  }
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single();
  writeFileSync(SEED, JSON.stringify({ node: { x: node.x, y: node.y, data: { ...node.data, docHeadRevision: 1 } }, doc: data?.doc }));
}

async function inkOf(page: Page): Promise<number> {
  const box = await frameTile(page).boundingBox({ timeout: PROBE_MS }).catch(() => null);
  if (!box || box.width < 4 || box.height < 4) {
    return 0;
  }
  const screen = page.viewportSize()!;
  const [left, top] = [Math.max(0, box.x), Math.max(0, box.y)];
  const clip = { x: left, y: top, width: Math.min(box.x + box.width, screen.width) - left, height: Math.min(box.y + box.height, screen.height) - top };
  const shot = clip.width > 4 && clip.height > 4 ? await page.screenshot({ timeout: PROBE_MS, clip }).catch(() => null) : null;
  if (!shot) {
    return 0;
  }
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = new OffscreenCanvas(img.width, img.height);
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    let ink = 0;
    for (let i = 0; i < d.length; i += 4) {
      ink += d[i] + d[i + 1] + d[i + 2] < 600 ? 1 : 0;
    }
    return ink / (d.length / 4);
  }, shot.toString('base64'));
}

const widthOf = async (page: Page) => (await frameTile(page).boundingBox({ timeout: PROBE_MS }).catch(() => null))?.width ?? null;

test('a tall imported frame paints and zooms right after the canvas reopens', async ({ page, session, admin, seedNode }) => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(IMPORT_MS + 120_000);

  await canvasOpen(page, session);
  await (SEED && existsSync(SEED) ? seeded(admin, session, seedNode, SEED) : imported(page, admin, session));
  await canvasOpen(page, session);
  await expect(frameTile(page)).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(4_000);

  await page.addInitScript(() => {
    const w = window as unknown as { longTasks: number[] };
    w.longTasks = [];
    new PerformanceObserver((list) => list.getEntries().forEach((e) => w.longTasks.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true });
  });
  await page.reload();
  await expect(frameTile(page)).toBeVisible({ timeout: 30_000 });
  const shown = Date.now();

  let painted: number | null = null;
  let zoomed: number | null = null;
  let asked = 0;
  let before: number | null = null;
  while (Date.now() - shown < WATCH_MS && (painted === null || zoomed === null)) {
    if (painted === null && (await inkOf(page)) > INK_SHARE) {
      painted = Date.now() - shown;
    }
    const box = asked ? null : await frameTile(page).boundingBox({ timeout: PROBE_MS }).catch(() => null);
    if (box && Date.now() - shown >= ZOOM_AFTER_MS) {
      before = box.width;
      await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 200));
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, ZOOM_STEP);
      await page.keyboard.up('Control');
      asked = Date.now();
    }
    const width = asked && zoomed === null ? await widthOf(page) : null;
    if (width !== null && width !== before) {
      zoomed = Date.now() - asked;
    }
    await page.waitForTimeout(SAMPLE_MS);
  }
  const longest = Math.max(0, ...(await page.evaluate(() => (window as unknown as { longTasks: number[] }).longTasks)));

  expect(longest, 'no single main-thread task blocks the canvas after it reopens').toBeLessThan(LONGEST_TASK_MS);
  expect(zoomed, 'ctrl+scroll zooms while the frame is loading').not.toBeNull();
  expect(zoomed!).toBeLessThan(ZOOM_MS);
  expect(painted, 'the frame shows its content soon after its tile').not.toBeNull();
  expect(painted!).toBeLessThan(PAINT_MS);
});
