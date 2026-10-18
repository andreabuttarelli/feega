import type { Locator, Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const MOVES = 5;
const STEP = 70;
const QUICK_MS = 150;
const SETTLE_MS = 1500;
const DRIFT_PX = 3;

type Sample = { frame: number; present: boolean; same: boolean; x: number; y: number };

test.use({ video: process.env.E2E_VIDEO ? 'on' : 'off' });

async function drawBox(page: Page): Promise<string> {
  await page.setViewportSize({ width: 1440, height: 900 });
  await pickBarTool(page, 'rectangle');
  const pane = (await page.locator('.svelte-flow').boundingBox())!;
  const from = { x: pane.x + pane.width * 0.3, y: pane.y + pane.height * 0.3 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 80, from.y + 50);
  await page.mouse.move(from.x + 160, from.y + 100);
  await page.mouse.up();
  const element = page.locator('[data-kind="element"][data-motion-node]');
  await expect(element).toHaveCount(1, { timeout: 15_000 });
  await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 15_000 });
  return (await element.getAttribute('data-motion-node'))!;
}

const emptyPoint = (page: Page) =>
  page.evaluate(() => {
    for (let y = 60; y < innerHeight; y += 20) {
      for (let x = 80; x < innerWidth; x += 20) {
        if (document.elementFromPoint(x, y)?.classList.contains('svelte-flow__pane')) {
          return { x, y };
        }
      }
    }
    return null;
  });

async function deselect(page: Page) {
  const empty = (await emptyPoint(page))!;
  await page.mouse.click(empty.x, empty.y);
  await expect(page.getByTestId('motion-editor')).toHaveCount(0, { timeout: 10_000 });
}

async function watch(page: Page, nodeId: string) {
  await page.evaluate((id) => {
    const w = window as unknown as { __samples: Sample[] };
    w.__samples = [];
    const node = () => document.querySelector(`.svelte-flow__node[data-id="${id}"]`);
    const first = node();
    let frame = 0;
    const tick = () => {
      const now = node();
      const rect = now?.getBoundingClientRect();
      w.__samples.push({ frame, present: !!now && (rect?.width ?? 0) > 0, same: now === first, x: rect?.x ?? 0, y: rect?.y ?? 0 });
      frame += 1;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, nodeId);
}

const samples = (page: Page) => page.evaluate(() => (window as unknown as { __samples: Sample[] }).__samples);

async function flowAt(tile: Locator) {
  const [x, y] = await tile.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).transformPoint(new DOMPoint(0, 0)).toJSON() as { x: number; y: number }).then((p) => [p.x, p.y]);
  return { x: Math.round(x), y: Math.round(y) };
}

async function dragBy(page: Page, tile: Locator) {
  const box = (await tile.boundingBox())!;
  const grab = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x + STEP / 2, grab.y + STEP / 4, { steps: 4 });
  await page.mouse.move(grab.x + STEP, grab.y + STEP / 2, { steps: 4 });
  await page.mouse.up();
  return box;
}

async function headDoc(admin: SupabaseClient, nodeId: string) {
  const { data } = await admin.from('motion_revisions').select('version, doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1).single();
  return data;
}

async function expectFilled(page: Page, tile: Locator) {
  await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: 10_000 });
  const node = (await tile.boundingBox())!;
  const shape = (await page.getByTestId('selection-box').boundingBox())!;
  for (const [a, b, what] of [
    [shape.x, node.x, 'left'],
    [shape.y, node.y, 'top'],
    [shape.width, node.width, 'width'],
    [shape.height, node.height, 'height']
  ] as const) {
    expect(Math.abs(a - b), `the shape fills its node: ${what}`).toBeLessThan(DRIFT_PX * 2);
  }
}

test.describe('a free box stays fluid @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('moved five times, it follows every drag, never disappears, never remounts, never goes back, and stays after a reload', async ({ page, session, admin }) => {
    test.setTimeout(180_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const nodeId = await drawBox(page);
    await deselect(page);
    await page.waitForTimeout(SETTLE_MS);
    const tile = page.locator(`.svelte-flow__node[data-id="${nodeId}"]`);
    await watch(page, nodeId);
    const docBefore = await headDoc(admin, nodeId);

    for (let i = 0; i < MOVES; i += 1) {
      const before = await dragBy(page, tile);
      const after = (await tile.boundingBox())!;
      expect(after.x - before.x, `drag ${i + 1} moved the box`).toBeGreaterThan(STEP / 2);
      await page.waitForTimeout(i % 2 === 0 ? QUICK_MS : SETTLE_MS);
    }
    await page.waitForTimeout(SETTLE_MS * 2);

    const seen = await samples(page);
    expect(seen.length).toBeGreaterThan(100);
    expect(seen.filter((s) => !s.present).map((s) => s.frame), 'frames with the box gone').toEqual([]);
    expect(seen.filter((s) => !s.same).map((s) => s.frame), 'frames on a remounted box').toEqual([]);
    const xs = seen.map((s) => s.x);
    expect(xs.filter((x, i) => i > 0 && x < xs[i - 1] - DRIFT_PX), 'frames where the box jumped back').toEqual([]);
    expect(await headDoc(admin, nodeId), 'the shape never moved inside its node').toEqual(docBefore);
    await expectFilled(page, tile);

    const placed = await flowAt(tile);
    await expect
      .poll(async () => {
        const { data } = await admin.from('nodes').select('x, y').eq('id', nodeId).single();
        return data ? { x: Math.round(data.x), y: Math.round(data.y) } : null;
      }, { message: 'saved where it was dropped', timeout: 10_000 })
      .toEqual(placed);
    await page.reload();
    await page.waitForLoadState('networkidle');
    expect(await flowAt(tile), 'where it is after a reload').toEqual(placed);
  });

  test('resized by a corner, the node grows with the shape and nothing is clipped', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const nodeId = await drawBox(page);
    const tile = page.locator(`.svelte-flow__node[data-id="${nodeId}"]`);
    await expectFilled(page, tile);
    const start = await admin.from('nodes').select('x, y, width, height').eq('id', nodeId).single();
    const before = (await tile.boundingBox())!;
    const corner = page.getByTestId('selection-overlay').locator('[data-handle="2"]');
    const grip = (await corner.boundingBox())!;
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 + STEP, grip.y + grip.height / 2 + STEP / 2, { steps: 8 });
    await page.mouse.up();

    const after = (await tile.boundingBox())!;
    expect(after.width - before.width, 'the node grew').toBeGreaterThan(STEP / 2);
    expect(Math.abs(after.x - before.x), 'its left edge stayed').toBeLessThan(DRIFT_PX);
    await page.waitForTimeout(SETTLE_MS);
    await expectFilled(page, tile);
    await expect
      .poll(async () => (await admin.from('nodes').select('width').eq('id', nodeId).single()).data?.width ?? 0, { message: 'the bigger node is saved', timeout: 10_000 })
      .toBeGreaterThan(start.data!.width + STEP / 4);
  });

  test('recoloured then deselected, nothing reloads: same box, no fetch, no blank frame', async ({ page, session }) => {
    test.setTimeout(120_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const nodeId = await drawBox(page);
    const hex = page.getByTestId('fill-editor').locator('input.hex').first();
    if (!(await hex.isVisible())) {
      await page.getByTestId('motion-inspector').getByTestId('fill-stack').first().getByTestId('fill-swatch').first().click();
    }
    await hex.fill('#ff0000');
    await hex.press('Enter');
    await page.waitForTimeout(300);

    await watch(page, nodeId);
    await page.evaluate((id) => {
      const w = window as unknown as { __players: number };
      w.__players = 0;
      const tile = document.querySelector(`.svelte-flow__node[data-id="${id}"]`)!;
      new MutationObserver((changes) => {
        for (const change of changes) {
          change.addedNodes.forEach((n) => {
            if (n instanceof Element && (n.tagName === 'HYPERFRAMES-PLAYER' || n.querySelector('hyperframes-player'))) {
              w.__players += 1;
            }
          });
        }
      }).observe(tile, { subtree: true, childList: true });
    }, nodeId);
    const reloads: string[] = [];
    page.on('request', (req) => {
      if (/fonts\.googleapis|__data\.json|\/(session|preview)(\?|$)/.test(req.url())) {
        reloads.push(req.url());
      }
    });
    await deselect(page);
    await page.waitForTimeout(SETTLE_MS * 2);

    const seen = await samples(page);
    expect(seen.length).toBeGreaterThan(60);
    expect(seen.filter((s) => !s.present).map((s) => s.frame), 'frames with the box gone').toEqual([]);
    expect(seen.filter((s) => !s.same).map((s) => s.frame), 'frames on a remounted box').toEqual([]);
    expect(await page.evaluate(() => (window as unknown as { __players: number }).__players), 'players mounted on the tile after the deselect').toBe(0);
    expect(reloads, 'page data, session, preview or player fonts fetched after the deselect').toEqual([]);
  });
});
