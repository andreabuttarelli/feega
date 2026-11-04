import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

type Clip = { component: string; props: { fills?: { color?: string }[] } };
type Doc = { tracks: { clips: Clip[] }[] };

const FILL = '#16a34a';
const SERVER_LAG_MS = 1500;
const LANDED_MS = 20_000;

const elements = (page: Page) => page.locator('[data-kind="element"][data-motion-node]');
const status = (page: Page) => page.locator('.save-status');
const fillHex = (page: Page) => page.getByLabel('Fill colour hex');

async function headFill(admin: SupabaseClient, nodeId: string): Promise<string | null> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  const doc = data?.[0]?.doc as Doc | undefined;
  return doc?.tracks.flatMap((t) => t.clips).find((c) => c.component === 'Shape')?.props.fills?.[0]?.color?.toLowerCase() ?? null;
}

async function alive(admin: SupabaseClient, nodeId: string): Promise<boolean> {
  const { data } = await admin.from('nodes').select('id').eq('id', nodeId).is('deleted_at', null);
  return (data ?? []).length === 1;
}

async function draw(page: Page, tool: string, at: { x: number; y: number }) {
  await pickBarTool(page, tool);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 80, at.y + 50, { steps: 3 });
  await page.mouse.move(at.x + 160, at.y + 100, { steps: 3 });
  await page.mouse.up();
}

async function drawn(page: Page, tool: string, at: { x: number; y: number }): Promise<string> {
  const before = new Set(await elements(page).evaluateAll((all) => all.map((e) => (e as HTMLElement).dataset.motionNode)));
  await draw(page, tool, at);
  await expect.poll(async () => (await elements(page).count()) > before.size, { timeout: 10_000 }).toBe(true);
  const after = await elements(page).evaluateAll((all) => all.map((e) => (e as HTMLElement).dataset.motionNode));
  return after.find((id) => id && !before.has(id))!;
}

async function fill(page: Page, nodeId: string, hex: string) {
  await page.locator(`[data-motion-node="${nodeId}"]`).click();
  await expect(page.getByTestId('motion-inspector')).toBeVisible({ timeout: 15_000 });
  if (!(await fillHex(page).isVisible())) {
    await page.getByTestId('motion-inspector').getByTestId('fill-stack').first().getByTestId('fill-swatch').first().click();
  }
  await fillHex(page).fill(hex.slice(1));
  await fillHex(page).press('Enter');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
}

async function pane(page: Page) {
  const box = (await page.locator('.svelte-flow').boundingBox())!;
  return { x: box.x + box.width * 0.3, y: box.y + box.height * 0.3 };
}

test.describe('edits made offline or mid-save are kept @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('a fill and a shape made offline stay on the canvas, are counted, and land once back online', async ({ page, session, admin }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const at = await pane(page);
    const box = await drawn(page, 'rectangle', at);
    await expect(status(page)).toHaveAttribute('data-status', 'saved', { timeout: LANDED_MS });

    await page.context().setOffline(true);
    await fill(page, box, FILL);
    const ellipse = await drawn(page, 'ellipse', { x: at.x, y: at.y + 220 });
    await page.waitForTimeout(3000);

    await expect(page.locator(`[data-motion-node="${ellipse}"]`), 'the offline shape stays').toBeVisible();
    await expect(status(page)).toHaveAttribute('data-status', 'offline');
    await expect(status(page)).toHaveAttribute('aria-label', /[2-9] changes waiting/);

    await page.context().setOffline(false);
    await expect.poll(() => alive(admin, ellipse), { timeout: LANDED_MS }).toBe(true);
    await expect.poll(() => headFill(admin, box), { timeout: LANDED_MS }).toBe(FILL);
    await expect(status(page)).toHaveAttribute('data-status', 'saved', { timeout: LANDED_MS });
  });

  test('a fill and a shape still on their way when the tab closes land after it reopens', async ({ page, session, admin }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const at = await pane(page);
    const box = await drawn(page, 'rectangle', at);
    await expect(status(page)).toHaveAttribute('data-status', 'saved', { timeout: LANDED_MS });

    await page.route(/\?\/|[?&]action=/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, SERVER_LAG_MS));
      await route.continue().catch(() => undefined);
    });
    await fill(page, box, FILL);
    const ellipse = await drawn(page, 'ellipse', { x: at.x, y: at.y + 220 });
    await expect(status(page)).not.toHaveAttribute('data-status', 'saved');
    await page.close({ runBeforeUnload: false });

    const again = await page.context().newPage();
    await gotoHydrated(again, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect.poll(() => alive(admin, ellipse), { timeout: LANDED_MS }).toBe(true);
    await expect.poll(() => headFill(admin, box), { timeout: LANDED_MS }).toBe(FILL);
  });

  test('undo removes a shape drawn offline at once, and it never lands', async ({ page, session, admin }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const at = await pane(page);

    await page.context().setOffline(true);
    const ellipse = await drawn(page, 'ellipse', at);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Meta+z');
    await expect(page.locator(`[data-motion-node="${ellipse}"]`), 'gone before the connection returns').toHaveCount(0, { timeout: 2000 });

    await page.context().setOffline(false);
    await expect(status(page)).toHaveAttribute('data-status', 'saved', { timeout: LANDED_MS });
    expect(await alive(admin, ellipse)).toBe(false);
  });

  test('undo, redo, undo then an immediate reload keeps the last undo', async ({ page, session, admin }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const at = await pane(page);
    const box = await drawn(page, 'rectangle', at);
    await expect(status(page)).toHaveAttribute('data-status', 'saved', { timeout: LANDED_MS });
    const startY = (await admin.from('nodes').select('y').eq('id', box).single()).data?.y;

    const centre = (await page.locator(`[data-motion-node="${box}"]`).boundingBox())!;
    await pickBarTool(page, 'select');
    await page.mouse.move(centre.x + centre.width / 2, centre.y + centre.height / 2);
    await page.mouse.down();
    await page.mouse.move(centre.x + centre.width / 2, centre.y + centre.height / 2 + 100, { steps: 6 });
    await page.mouse.up();
    await expect(status(page)).toHaveAttribute('data-status', 'saved', { timeout: LANDED_MS });
    await page.keyboard.press('Escape');

    await page.keyboard.press('Meta+z');
    await page.waitForTimeout(300);
    await page.keyboard.press('Meta+Shift+z');
    await page.waitForTimeout(300);
    await page.keyboard.press('Meta+z');
    await page.reload();

    await expect.poll(async () => (await admin.from('nodes').select('y').eq('id', box).single()).data?.y, { timeout: LANDED_MS }).toBe(startY);
  });
});
