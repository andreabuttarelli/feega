import { homedir } from 'node:os';
import sharp from 'sharp';
import type { Locator, Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated, type E2eSession } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;
const LONG_LINE = 'Auto width grows with every single keystroke';
const SLACK_PX = 2;

type Clip = { id: string; component: string; props: Record<string, unknown> };
type Box = { x: number; y: number; width: number; height: number };

async function freeTexts(admin: SupabaseClient, session: E2eSession) {
  const { data } = await admin.from('nodes').select('id, type, width, height, data').eq('canvas_id', session.canvasId).is('deleted_at', null);
  return (data ?? []).filter((n) => n.type === 'element');
}

async function clipOf(admin: SupabaseClient, nodeId: string): Promise<Clip> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  return (data?.[0]?.doc as { tracks: { clips: Clip[] }[] }).tracks[0].clips[0];
}

async function inkRight(page: Page, area: Box, path: string): Promise<number> {
  const png = await page.screenshot({ path, clip: area });
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const background = data[0] + data[1] + data[2];
  let right = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = info.width - 1; x > right; x--) {
      const i = (y * info.width + x) * 3;
      if (Math.abs(data[i] + data[i + 1] + data[i + 2] - background) > 240) {
        right = x;
      }
    }
  }
  return area.x + right;
}

async function expectUnclipped(field: Locator) {
  const fit = await field.evaluate((el: HTMLTextAreaElement) => ({ scroll: el.scrollWidth, client: el.clientWidth, scrollH: el.scrollHeight, clientH: el.clientHeight }));
  expect(fit.scroll, 'the editor is as wide as its text').toBeLessThanOrEqual(fit.client + SLACK_PX);
  expect(fit.scrollH, 'the editor is as tall as its text').toBeLessThanOrEqual(fit.clientH + SLACK_PX);
}

test.describe('auto width text grows while typing @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');
  test.use({ viewport: { width: 1600, height: 1000 } });

  test('a free text set to auto width widens with every keystroke and hugs the line after commit', async ({ page, session, admin }) => {
    test.setTimeout(150_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await pickBarTool(page, 'text');
    const pane = (await page.locator('.svelte-flow').boundingBox())!;
    const at = { x: pane.x + pane.width * 0.2, y: pane.y + pane.height * 0.4 };
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 60, at.y + 30);
    await page.mouse.move(at.x + 120, at.y + 60);
    await page.mouse.up();
    const field = page.getByTestId('core-text-edit');
    await expect(field).toBeFocused({ timeout: 15_000 });
    await page.keyboard.type('Hi');
    await page.keyboard.press('Escape');
    await expect(field).toHaveCount(0);
    await expect.poll(async () => (await freeTexts(admin, session)).length, { timeout: 10_000 }).toBe(1);
    const [element] = await freeTexts(admin, session);
    const tile = page.locator(`[data-motion-node="${element.id}"]`);
    await expect(tile).toBeVisible({ timeout: 20_000 });

    await expect(page.getByTestId('frame-inspector')).toBeVisible({ timeout: 15_000 });
    await page.getByTestId('frame-inspector').getByRole('radio', { name: /auto width/i }).click();
    await expect.poll(async () => (await clipOf(admin, element.id)).props.sizing, { timeout: 10_000 }).toBe('auto');
    await page.waitForTimeout(SETTLE_MS);
    const before = (await tile.boundingBox())!;

    await tile.dblclick({ force: true });
    await expect(field).toBeFocused({ timeout: 15_000 });
    await page.keyboard.press('End');
    await page.keyboard.type(` ${LONG_LINE}`, { delay: 20 });
    await page.waitForTimeout(300);
    await expectUnclipped(field);
    const typed = (await field.boundingBox())!;
    expect(typed.width, 'the editor outgrows the box it started in').toBeGreaterThan(before.width * 2);
    expect(typed.height, 'auto width never wraps').toBeLessThan(before.height * 1.5);
    const area = { x: before.x - 4, y: typed.y - 4, width: Math.min(typed.x + typed.width + 40, pane.x + pane.width) - (before.x - 4), height: typed.height + 8 };
    const right = await inkRight(page, area, `${SHOTS}/autowidth-free-typing.png`);
    expect(right, 'glyphs are drawn past the old box').toBeGreaterThan(before.x + before.width + 40);
    expect(right).toBeLessThanOrEqual(typed.x + typed.width + SLACK_PX);

    await page.keyboard.press('Escape');
    await expect(field).toHaveCount(0);
    await page.waitForTimeout(SETTLE_MS);
    const after = (await tile.boundingBox())!;
    await page.screenshot({ path: `${SHOTS}/autowidth-free-after.png`, clip: { x: after.x - 20, y: after.y - 20, width: after.width + 40, height: after.height + 40 } });
    expect(Math.abs(after.width - typed.width), 'the stored box hugs the typed line').toBeLessThan(typed.width * 0.1);
  });

  test('a free text set to auto height keeps its width and grows down while typing', async ({ page, session, admin }) => {
    test.setTimeout(150_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await pickBarTool(page, 'text');
    const pane = (await page.locator('.svelte-flow').boundingBox())!;
    const at = { x: pane.x + pane.width * 0.2, y: pane.y + pane.height * 0.3 };
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 100, at.y + 30);
    await page.mouse.move(at.x + 200, at.y + 60);
    await page.mouse.up();
    const field = page.getByTestId('core-text-edit');
    await expect(field).toBeFocused({ timeout: 15_000 });
    await page.keyboard.type('Hi');
    await page.keyboard.press('Escape');
    await expect(field).toHaveCount(0);
    await expect.poll(async () => (await freeTexts(admin, session)).length, { timeout: 10_000 }).toBe(1);
    const [element] = await freeTexts(admin, session);
    const tile = page.locator(`[data-motion-node="${element.id}"]`);
    await page.getByTestId('frame-inspector').getByRole('radio', { name: /auto height/i }).click();
    await expect.poll(async () => (await clipOf(admin, element.id)).props.sizing, { timeout: 10_000 }).toBe('auto-height');
    await page.waitForTimeout(SETTLE_MS);
    const before = (await tile.boundingBox())!;

    await tile.dblclick({ force: true });
    await expect(field).toBeFocused({ timeout: 15_000 });
    await page.keyboard.press('End');
    await page.keyboard.type(` ${LONG_LINE} ${LONG_LINE}`, { delay: 10 });
    await page.waitForTimeout(300);
    await expectUnclipped(field);
    const typed = (await field.boundingBox())!;
    await page.screenshot({ path: `${SHOTS}/autowidth-height-typing.png`, clip: { x: typed.x - 20, y: typed.y - 20, width: typed.width + 40, height: typed.height + 40 } });
    expect(Math.abs(typed.width - before.width), 'auto height keeps the width').toBeLessThan(before.width * 0.1);
    expect(typed.height, 'auto height wraps and grows down').toBeGreaterThan(before.height * 1.8);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(SETTLE_MS);
    const after = (await tile.boundingBox())!;
    expect(Math.abs(after.height - typed.height), 'the stored box hugs the wrapped lines').toBeLessThan(typed.height * 0.15);
  });
});
