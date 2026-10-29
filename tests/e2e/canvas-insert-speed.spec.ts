import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const POSTER = 'builtin:poster-checker-steps';
const SHOWN_BUDGET_MS = 300;
const SAVED_BUDGET_MS = 3000;
const ECHO_SETTLE_MS = 2500;
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

type Clock = { shown: number | null; saved: number | null; serverTiming: string };

async function armClock(page: Page, shownSelector: string, action: string, start: 'pointerdown' | 'drop') {
  await page.evaluate(
    ({ shownSelector, action, start }) => {
      const w = window as unknown as { __insert: { click: number | null; shown: number | null; saved: number | null; serverTiming: string } };
      w.__insert = { click: null, shown: null, saved: null, serverTiming: '' };
      document.addEventListener(start, () => (w.__insert.click ??= performance.now()), { capture: true, once: true });
      const seen = () => {
        if (w.__insert.click !== null && w.__insert.shown === null && document.querySelector(shownSelector)) {
          w.__insert.shown = performance.now();
        }
      };
      new MutationObserver(seen).observe(document.body, { subtree: true, childList: true, attributes: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
          if (new URL(entry.name).searchParams.get('action') === action && w.__insert.saved === null) {
            w.__insert.saved = entry.responseEnd;
            w.__insert.serverTiming = (entry.serverTiming ?? []).map((t) => `${t.name}=${Math.round(t.duration)}`).join(' ');
          }
        }
      }).observe({ type: 'resource', buffered: false });
    },
    { shownSelector, action, start }
  );
}

async function readClock(page: Page): Promise<Clock> {
  await expect.poll(() => page.evaluate(() => (window as unknown as { __insert: { saved: number | null } }).__insert.saved), { timeout: 15_000 }).not.toBeNull();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __insert: { shown: number | null } }).__insert.shown), { timeout: 15_000 }).not.toBeNull().catch(() => undefined);
  return page.evaluate(() => {
    const c = (window as unknown as { __insert: { click: number; shown: number | null; saved: number; serverTiming: string } }).__insert;
    return { shown: c.shown === null ? null : Math.round(c.shown - c.click), saved: Math.round(c.saved - c.click), serverTiming: c.serverTiming };
  });
}

async function motionRows(admin: SupabaseClient, canvasId: string) {
  return (await admin.from('nodes').select('id').eq('canvas_id', canvasId).eq('type', 'motion').is('deleted_at', null)).data ?? [];
}

async function generatedImage(admin: SupabaseClient, session: { orgId: string; projectId: string }) {
  const path = `${session.orgId}/${session.projectId}/e2e/${randomUUID()}.png`;
  await admin.storage.from('canvas-assets').upload(path, PNG_1X1, { contentType: 'image/png' });
  const { data, error } = await admin
    .from('assets')
    .insert({ org_id: session.orgId, project_id: session.projectId, type: 'image', url: path, mime_type: 'image/png', bytes: PNG_1X1.length, width: 1, height: 1, source: 'upload' })
    .select('id')
    .single();
  expect(error).toBeNull();
  return data!.id as string;
}

test.describe('a node lands on the canvas at once @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');
  test.describe.configure({ mode: 'serial' });

  test('a frame template shows its final look within 300 ms, saves within 3 s, and its echo adds nothing', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

    await page.getByTestId('frame-templates').click();
    const picker = page.getByRole('dialog', { name: 'Frame templates' });
    await picker.getByRole('radio', { name: 'Still', exact: true }).click();
    await picker.getByTestId('component-search').fill('checker');
    await expect(picker.locator(`[data-component="${POSTER}"] img`)).toBeVisible();

    await armClock(page, '[data-testid=motion-node-poster]', 'frame_template', 'pointerdown');
    await picker.locator(`[data-component="${POSTER}"]`).click();
    const clock = await readClock(page);
    console.log(`frame_template shown=${clock.shown}ms saved=${clock.saved}ms server: ${clock.serverTiming}`);

    expect(clock.shown, 'the final look, not a placeholder').not.toBeNull();
    expect(clock.shown!).toBeLessThan(SHOWN_BUDGET_MS);
    expect(clock.saved).toBeLessThan(SAVED_BUDGET_MS);

    await page.waitForTimeout(ECHO_SETTLE_MS);
    await expect(page.locator('[data-testid=motion-node]')).toHaveCount(1);
    expect(await motionRows(admin, session.canvasId)).toHaveLength(1);
  });

  test('a generated image placed on the canvas shows within 300 ms, saves within 3 s, and its echo adds nothing', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const assetId = await generatedImage(admin, session);
    const gen = await seedNode({ type: 'image', x: 80, y: 520, data: { prompt: 'an image', refId: assetId } });

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`[data-id="${gen.id}"] .gen-body`).hover();

    await armClock(page, '[data-testid=motion-node-pending] img, [data-testid=motion-node]', 'placeOutput', 'drop');
    await page.getByTestId('drag-to-frame').dragTo(page.locator('.svelte-flow__pane'), { targetPosition: { x: 720, y: 120 } });
    const clock = await readClock(page);
    console.log(`placeOutput shown=${clock.shown}ms saved=${clock.saved}ms server: ${clock.serverTiming}`);

    expect(clock.shown).not.toBeNull();
    expect(clock.shown!).toBeLessThan(SHOWN_BUDGET_MS);
    expect(clock.saved).toBeLessThan(SAVED_BUDGET_MS);

    await page.waitForTimeout(ECHO_SETTLE_MS);
    await expect(page.locator('[data-testid=motion-node]')).toHaveCount(1);
    expect(await motionRows(admin, session.canvasId)).toHaveLength(1);
  });
});
