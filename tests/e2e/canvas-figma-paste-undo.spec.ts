import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOTS_DIR } from './fixtures/shots';
import { figmaClipboardHtml } from '../fixtures/figma/clipboard';
import { elementsOnly } from '../fixtures/figma/elements';

const SLOW_SERVER_MS = 2_000;
const FRAME_BUDGET = 2;
const SETTLE_MS = 3_000;
const PLACEHOLDER = '[data-testid="figma-paste-placeholder"]';
const TILE = '[data-testid="gpu-node"]';

enum Probe {
  Present = 'present',
  Absent = 'absent'
}

async function watch(page: Page, probe: Probe, selector: string) {
  await page.evaluate(
    ({ probe, selector }) => {
      const state = { start: 0, shown: 0, frames: 0 };
      (window as unknown as { uiProbe: typeof state }).uiProbe = state;
      const met = () => (probe === 'present') === Boolean(document.querySelector(selector));
      window.addEventListener(
        'keydown',
        () => {
          state.start = performance.now();
          const tick = () => {
            state.frames += 1;
            if (met()) {
              state.shown = performance.now();
              return;
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        },
        { capture: true, once: true }
      );
    },
    { probe, selector }
  );
}

async function framesTaken(page: Page): Promise<number> {
  await expect.poll(() => page.evaluate(() => (window as unknown as { uiProbe: { shown: number } }).uiProbe.shown), { timeout: 15_000 }).toBeGreaterThan(0);
  return page.evaluate(() => (window as unknown as { uiProbe: { frames: number } }).uiProbe.frames);
}

async function slowServer(page: Page) {
  await page.route(
    (url) => url.searchParams.get('action') === 'pasteFigma' || url.searchParams.get('action') === 'undo',
    async (route) => {
      await new Promise((done) => setTimeout(done, SLOW_SERVER_MS));
      await route.continue();
    }
  );
}

async function liveNodes(admin: SupabaseClient, canvasId: string): Promise<number> {
  const { data } = await admin.from('nodes').select('id').eq('canvas_id', canvasId).is('deleted_at', null);
  return data?.length ?? 0;
}

async function pasteFigma(page: Page) {
  await page.evaluate(async (body) => {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([body], { type: 'text/html' }), 'text/plain': new Blob(['figma'], { type: 'text/plain' }) })]);
  }, figmaClipboardHtml(elementsOnly()));
  await page.waitForTimeout(SETTLE_MS);
  const pane = (await page.locator('.svelte-flow').boundingBox())!;
  await page.mouse.click(pane.x + pane.width * 0.9, pane.y + pane.height * 0.9);
  await page.mouse.move(pane.x + pane.width * 0.5, pane.y + pane.height * 0.5);
  await watch(page, Probe.Present, PLACEHOLDER);
  await page.keyboard.press('ControlOrMeta+v');
  expect(await framesTaken(page), 'placeholder shows before the server answers').toBeLessThanOrEqual(FRAME_BUDGET);
}

test.use({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1600, height: 900 } });

test.describe('figma paste is one optimistic undo step @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('undo after the paste lands removes every pasted node within two frames', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await slowServer(page);
    await pasteFigma(page);
    await page.screenshot({ path: `${SHOTS_DIR}/figma-paste-1-loading.png` });

    await expect(page.locator(TILE).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(PLACEHOLDER)).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS_DIR}/figma-paste-2-landed.png` });

    await watch(page, Probe.Absent, TILE);
    await page.keyboard.press('ControlOrMeta+z');
    expect(await framesTaken(page), 'undo shows before the server answers').toBeLessThanOrEqual(FRAME_BUDGET);
    await expect.poll(() => liveNodes(admin, session.canvasId), { timeout: 30_000 }).toBe(0);
  });

  test('undo while the import loads cancels it and drops the late result', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await slowServer(page);
    await pasteFigma(page);

    await watch(page, Probe.Absent, PLACEHOLDER);
    await page.keyboard.press('ControlOrMeta+z');
    expect(await framesTaken(page), 'cancel shows before the server answers').toBeLessThanOrEqual(FRAME_BUDGET);

    await page.waitForTimeout(SLOW_SERVER_MS * 3);
    await expect(page.locator(TILE)).toHaveCount(0);
    await expect.poll(() => liveNodes(admin, session.canvasId), { timeout: 30_000 }).toBe(0);
  });
});
