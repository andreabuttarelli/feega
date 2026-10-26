import type { Page } from '@playwright/test';
import { pickBarTool } from './fixtures/canvas-bar';
import sharp from 'sharp';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHADES = ['#ff0000', '#0000ff', '#ff00ff', '#00ffff', '#00aa00'];
const GREEN_SHARE_MIN = 0.3;

type Box = { x: number; y: number; width: number; height: number };

async function greenShare(page: Page, clip: Box): Promise<number> {
  const { data, info } = await sharp(await page.screenshot({ clip })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let green = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] < 80 && data[i + 1] > 120 && data[i + 2] < 80) {
      green += 1;
    }
  }
  return green / (info.width * info.height);
}

const fillHex = (page: Page) => page.getByTestId('fill-editor').locator('input.hex').first();

async function recolour(page: Page, colour: string) {
  if (!(await fillHex(page).isVisible())) {
    await page.getByTestId('motion-inspector').getByTestId('fill-stack').first().getByTestId('fill-swatch').first().click();
  }
  await fillHex(page).fill(colour);
  await fillHex(page).press('Enter');
}

type Admin = Parameters<Parameters<typeof test>[2]>[0]['admin'];
type Fills = { tracks: { clips: { props: { fills?: { color: string }[] } }[] }[] };

async function savedFill(admin: Admin, canvasId: string): Promise<string | undefined> {
  const { data: nodes } = await admin.from('nodes').select('id').eq('canvas_id', canvasId).is('deleted_at', null);
  const { data } = await admin.from('motion_revisions').select('doc').in('node_id', (nodes ?? []).map((n) => n.id)).order('version', { ascending: false }).limit(1);
  return (data?.[0]?.doc as Fills | undefined)?.tracks[0]?.clips[0]?.props.fills?.[0]?.color;
}

const emptyCanvasPoint = (page: Page) =>
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

test.describe('rapid frame edits survive a reload @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  test('five recolours in a row, deselect, reload: the box is the last colour', async ({ page, session, admin }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const canvas = `/p/${session.projectId}/c/${session.canvasId}`;
    await page.addInitScript(() => localStorage.setItem('feega.frame-edit-mode', 'design'));
    await gotoHydrated(page, canvas);
    await pickBarTool(page, 'rectangle');
    const pane = (await page.locator('.svelte-flow').boundingBox())!;
    const from = { x: pane.x + pane.width * 0.35, y: pane.y + pane.height * 0.35 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 240, from.y + 120);
    await page.mouse.up();
    await expect(page.getByTestId('motion-inspector')).toBeVisible({ timeout: 15_000 });

    for (const shade of SHADES) {
      await recolour(page, shade);
    }
    const empty = (await emptyCanvasPoint(page))!;
    await page.mouse.click(empty.x, empty.y);
    await expect(page.getByTestId('motion-inspector')).toHaveCount(0, { timeout: 10_000 });
    await expect.poll(() => savedFill(admin, session.canvasId), { timeout: 15_000, message: 'the last colour is saved' }).toBe(SHADES.at(-1));

    await gotoHydrated(page, canvas);
    const element = page.locator('[data-testid="frame-overlays"] [data-frame]');
    await expect(element).toHaveCount(1, { timeout: 15_000 });
    await expect.poll(async () => greenShare(page, (await element.boundingBox())!), { timeout: 20_000, message: 'the reloaded tile shows the last colour' }).toBeGreaterThan(GREEN_SHARE_MIN);
  });
});
