import { homedir } from 'node:os';
import sharp from 'sharp';
import type { Locator, Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated, type E2eSession } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const KEYSTROKES = 'Hello wide new text!';
const SLACK_PX = 2;
const ZOOM_IN_PRESSES: Record<number, number> = { 1: 0, 2: 4 };
const ZOOMS = [1, 2] as const;

type Clip = { component: string; props: Record<string, unknown> };

async function texts(admin: SupabaseClient, session: E2eSession) {
  const { data } = await admin.from('nodes').select('id, type').eq('canvas_id', session.canvasId).is('deleted_at', null);
  return (data ?? []).filter((n) => n.type === 'element');
}

async function sizingOf(admin: SupabaseClient, nodeId: string): Promise<unknown> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  const clips = (data?.[0]?.doc as { tracks: { clips: Clip[] }[] } | undefined)?.tracks.flatMap((t) => t.clips) ?? [];
  return clips.find((c) => c.component === 'Text')?.props.sizing;
}

type Area = { x: number; y: number; width: number; height: number };

async function inkRows(page: Page, area: Area): Promise<{ bands: number; bottom: number }> {
  const png = await page.screenshot({ clip: area });
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const background = data[0] + data[1] + data[2];
  let bands = 0;
  let bottom = -1;
  let inBand = false;
  for (let y = 0; y < info.height; y++) {
    let inked = false;
    for (let x = 0; x < info.width && !inked; x++) {
      const i = (y * info.width + x) * 3;
      inked = Math.abs(data[i] + data[i + 1] + data[i + 2] - background) > 240;
    }
    if (inked && !inBand) {
      bands++;
    }
    if (inked) {
      bottom = y;
    }
    inBand = inked;
  }
  return { bands, bottom: area.y + bottom };
}

async function zoomTo(page: Page, zoom: number) {
  const pane = (await page.locator('.svelte-flow').boundingBox())!;
  await page.mouse.move(pane.x + pane.width * 0.8, pane.y + pane.height * 0.8);
  await page.keyboard.press('Shift+Digit0');
  for (let i = 0; i < ZOOM_IN_PRESSES[zoom]; i++) {
    await page.keyboard.press('+');
  }
  await page.waitForTimeout(400);
}

async function expectHugged(field: Locator, step: number) {
  const fit = await field.evaluate((el: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const ink = range.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return { scroll: el.scrollWidth, client: el.clientWidth, scrollH: el.scrollHeight, clientH: el.clientHeight, inkRight: ink.right, inkBottom: ink.bottom, boxRight: box.right, boxBottom: box.bottom };
  });
  expect(fit.scroll, `keystroke ${step}: no horizontal clip`).toBeLessThanOrEqual(fit.client + SLACK_PX);
  expect(fit.scrollH, `keystroke ${step}: no vertical clip`).toBeLessThanOrEqual(fit.clientH + SLACK_PX);
  expect(fit.inkRight, `keystroke ${step}: glyphs inside the box`).toBeLessThanOrEqual(fit.boxRight + SLACK_PX);
  expect(fit.inkBottom, `keystroke ${step}: glyphs inside the box`).toBeLessThanOrEqual(fit.boxBottom + SLACK_PX);
}

test.describe('a new text hugs what is typed @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');
  test.use({ viewport: { width: 1600, height: 1000 } });

  for (const zoom of ZOOMS) {
    test(`a click-made text widens with every keystroke at zoom ${zoom} and stays auto width`, async ({ page, session, admin }) => {
      test.setTimeout(150_000);
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await zoomTo(page, zoom);
      await pickBarTool(page, 'text');
      const pane = (await page.locator('.svelte-flow').boundingBox())!;
      await page.mouse.click(pane.x + pane.width * 0.2, pane.y + pane.height * 0.4);
      const field = page.getByTestId('core-text-edit');
      await expect(field).toBeFocused({ timeout: 15_000 });

      let widest = 0;
      for (const [i, key] of [...KEYSTROKES].entries()) {
        await page.keyboard.type(key);
        await expectHugged(field, i + 1);
        widest = Math.max(widest, (await field.boundingBox())!.width);
      }
      const box = (await field.boundingBox())!;
      await page.screenshot({ path: `${SHOTS}/newtext-click-z${zoom}.png`, clip: { x: box.x - 20, y: box.y - 20, width: box.width + 40, height: box.height + 40 } });
      expect(box.height, 'auto width never wraps').toBeLessThan(box.width / 3);

      await page.keyboard.press('Escape');
      await expect(field).toHaveCount(0);
      await expect.poll(async () => (await texts(admin, session)).length, { timeout: 10_000 }).toBe(1);
      const [element] = await texts(admin, session);
      await expect.poll(() => sizingOf(admin, element.id), { timeout: 10_000 }).toBe('auto');
    });
  }

  test('a drag-made text keeps its width, wraps while typing and the canvas shows every line after commit', async ({ page, session, admin }) => {
    test.setTimeout(150_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await pickBarTool(page, 'text');
    const pane = (await page.locator('.svelte-flow').boundingBox())!;
    const at = { x: pane.x + pane.width * 0.2, y: pane.y + pane.height * 0.3 };
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 60, at.y + 20);
    await page.mouse.move(at.x + 120, at.y + 40);
    await page.mouse.up();
    const field = page.getByTestId('core-text-edit');
    await expect(field).toBeFocused({ timeout: 15_000 });
    const start = (await field.boundingBox())!;

    for (const [i, key] of [...`${KEYSTROKES} ${KEYSTROKES}`].entries()) {
      await page.keyboard.type(key);
      await expectHugged(field, i + 1);
    }
    const box = (await field.boundingBox())!;
    await page.screenshot({ path: `${SHOTS}/newtext-drag.png`, clip: { x: box.x - 20, y: box.y - 20, width: box.width + 40, height: box.height + 40 } });
    expect(Math.abs(box.width - start.width), 'width stays').toBeLessThan(SLACK_PX * 2);
    expect(box.height, 'wraps down').toBeGreaterThan(start.height * 1.5);
    const typedRows = await page.getByTestId('core-text-edit').evaluate((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const tops = new Set<number>();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        [...range.getClientRects()].forEach((r) => tops.add(Math.round(r.top)));
      }
      return tops.size;
    });

    await page.keyboard.press('Escape');
    await expect(field).toHaveCount(0);
    await expect.poll(async () => (await texts(admin, session)).length, { timeout: 10_000 }).toBe(1);
    const [element] = await texts(admin, session);
    const tile = page.locator(`[data-motion-node="${element.id}"]`);
    await page.mouse.click(pane.x + pane.width * 0.9, pane.y + pane.height * 0.9);
    await page.waitForTimeout(2500);
    const after = (await tile.boundingBox())!;
    const area = { x: after.x - 4, y: after.y - 4, width: after.width + 8, height: Math.max(after.height, box.height) + 60 };
    await page.screenshot({ path: `${SHOTS}/newtext-drag-after.png`, clip: area });
    const ink = await inkRows(page, area);
    expect(ink.bands, 'the canvas shows as many lines as the editor did').toBe(typedRows);
    expect(ink.bottom, 'no line below the box').toBeLessThanOrEqual(after.y + after.height + SLACK_PX);
  });
});
