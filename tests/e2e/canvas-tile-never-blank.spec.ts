import type { Page } from '@playwright/test';
import sharp from 'sharp';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const WATCH_MS = 3000;
const TOOLS = ['rectangle', 'ellipse'] as const;
const COLOURS = ['#ff0000', '#00aa00'];
const RED_PIXELS_MAX = 0.01;

type Box = { x: number; y: number; width: number; height: number };

async function redShare(page: Page, clip: Box): Promise<number> {
  const { data, info } = await sharp(await page.screenshot({ clip })).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let red = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 200 && data[i + 1] < 80 && data[i + 2] < 80) {
      red += 1;
    }
  }
  return red / (info.width * info.height);
}

test.use({ video: process.env.E2E_VIDEO ? 'on' : 'off' });

type Watch = { frames: number; blank: number[] };

async function watchTile(page: Page, nodeId: string) {
  await page.evaluate((id) => {
    const w = window as unknown as { __watch: Watch };
    w.__watch = { frames: 0, blank: [] };
    const painted = () => {
      const tile = document.querySelector(`[data-motion-node="${id}"]`);
      if (!tile) {
        return false;
      }
      const img = tile.querySelector('[data-testid=motion-node-poster]') as HTMLImageElement | null;
      if (img?.complete && img.naturalWidth > 0) {
        return true;
      }
      if (tile.querySelector('[data-testid=motion-node-stage] [data-drawn="true"]')) {
        return true;
      }
      const stage = document.querySelector('[data-testid=editor-stage]') as HTMLElement | null;
      return !!tile.querySelector('[data-testid=motion-node-editing]') && stage?.dataset.shown === 'true' && getComputedStyle(stage).visibility !== 'hidden';
    };
    const tick = () => {
      if (!painted()) {
        w.__watch.blank.push(w.__watch.frames);
      }
      w.__watch.frames += 1;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, nodeId);
}

const readWatch = (page: Page) => page.evaluate(() => (window as unknown as { __watch: Watch }).__watch);

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

const fillHex = (page: Page) => page.getByTestId('fill-editor').locator('input.hex').first();

async function recolour(page: Page, colour: string) {
  if (!(await fillHex(page).isVisible())) {
    await page.getByTestId('motion-inspector').getByTestId('fill-stack').first().getByTestId('fill-swatch').first().click();
  }
  await fillHex(page).fill(colour);
  await fillHex(page).press('Enter');
}

async function deselect(page: Page) {
  const empty = (await emptyCanvasPoint(page))!;
  await page.mouse.click(empty.x, empty.y);
  await expect(page.getByTestId('motion-editor')).toHaveCount(0, { timeout: 10_000 });
}

test.describe('a free element tile is never blank @real', () => {
  test.skip(!REAL_STACK, 'richiede E2E_REAL_STACK=1');

  for (const tool of TOOLS) {
    test(`a ${tool} shows in every frame while it is selected, recoloured and deselected`, async ({ page, session }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await page.getByTestId('add-bar').getByTestId('draw-tools').locator(`[data-tool="${tool}"]`).click();
      const pane = (await page.locator('.svelte-flow').boundingBox())!;
      const from = { x: pane.x + pane.width * 0.35, y: pane.y + pane.height * 0.35 };
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + 120, from.y + 60);
      await page.mouse.move(from.x + 240, from.y + 120);
      await page.mouse.up();
      const element = page.locator('[data-kind="element"][data-motion-node]');
      await expect(element).toHaveCount(1, { timeout: 15_000 });
      const nodeId = (await element.getAttribute('data-motion-node'))!;
      await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 15_000 });
      await watchTile(page, nodeId);

      for (const colour of COLOURS) {
        await recolour(page, colour);
        await page.waitForTimeout(300);
        await deselect(page);
        await page.waitForTimeout(WATCH_MS);
        await element.click();
        await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 15_000 });
        await page.waitForTimeout(WATCH_MS);
      }
      await deselect(page);
      await page.waitForTimeout(WATCH_MS);

      const watch = await readWatch(page);
      expect(watch.frames).toBeGreaterThan(100);
      expect(watch.blank, `frames with the tile blank, of ${watch.frames}`).toEqual([]);
    });
  }

  test('a box recoloured red then green never shows red again once deselected', async ({ page, session }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('add-bar').getByTestId('draw-tools').locator('[data-tool="rectangle"]').click();
    const pane = (await page.locator('.svelte-flow').boundingBox())!;
    const from = { x: pane.x + pane.width * 0.35, y: pane.y + pane.height * 0.35 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 120, from.y + 60);
    await page.mouse.move(from.x + 240, from.y + 120);
    await page.mouse.up();
    const element = page.locator('[data-kind="element"][data-motion-node]');
    await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 15_000 });

    await recolour(page, COLOURS[0]);
    await page.waitForTimeout(300);
    await deselect(page);
    await page.waitForTimeout(WATCH_MS);
    const clip = (await element.boundingBox())!;
    expect(await redShare(page, clip), 'the tile shows the red box').toBeGreaterThan(0.3);

    await element.click();
    await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 15_000 });
    await recolour(page, COLOURS[1]);
    await page.waitForTimeout(300);
    const empty = (await emptyCanvasPoint(page))!;
    await page.mouse.click(empty.x, empty.y);

    const shares: number[] = [];
    const until = Date.now() + WATCH_MS;
    while (Date.now() < until) {
      shares.push(await redShare(page, clip));
    }
    expect(shares.length).toBeGreaterThan(10);
    expect(shares.filter((share) => share > RED_PIXELS_MAX), `red samples after the click, of ${shares.length}`).toEqual([]);
  });

  test('deselecting an edited box shows no loading state and fetches nothing', async ({ page, session }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('add-bar').getByTestId('draw-tools').locator('[data-tool="rectangle"]').click();
    const pane = (await page.locator('.svelte-flow').boundingBox())!;
    const from = { x: pane.x + pane.width * 0.35, y: pane.y + pane.height * 0.35 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 240, from.y + 120);
    await page.mouse.up();
    await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 15_000 });
    await recolour(page, COLOURS[1]);
    await page.waitForTimeout(300);

    const fetched: string[] = [];
    page.on('request', (req) => {
      if (/\/(session|preview)(\?|$)/.test(new URL(req.url()).pathname + '?')) {
        fetched.push(req.url());
      }
    });
    await page.evaluate(() => {
      const w = window as unknown as { __loading: number };
      w.__loading = 0;
      const tick = () => {
        w.__loading += document.querySelector('[data-testid=inline-motion-loading]') ? 1 : 0;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await deselect(page);
    await page.waitForTimeout(WATCH_MS);

    expect(await page.evaluate(() => (window as unknown as { __loading: number }).__loading), 'frames showing the loading state').toBe(0);
    expect(fetched, 'session or preview requests while closing').toEqual([]);
  });

  test('reopening an edited box fetches nothing and shows no loading state', async ({ page, session }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('add-bar').getByTestId('draw-tools').locator('[data-tool="rectangle"]').click();
    const pane = (await page.locator('.svelte-flow').boundingBox())!;
    const from = { x: pane.x + pane.width * 0.35, y: pane.y + pane.height * 0.35 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 240, from.y + 120);
    await page.mouse.up();
    const element = page.locator('[data-kind="element"][data-motion-node]');
    await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 15_000 });
    await recolour(page, COLOURS[1]);
    await page.waitForTimeout(300);
    await deselect(page);
    await page.waitForTimeout(WATCH_MS);

    const fetched: string[] = [];
    page.on('request', (req) => {
      if (/\/(session|preview)(\?|$)/.test(new URL(req.url()).pathname + '?')) {
        fetched.push(req.url());
      }
    });
    await page.evaluate(() => {
      const w = window as unknown as { __loading: number };
      w.__loading = 0;
      const tick = () => {
        w.__loading += document.querySelector('[data-testid=inline-motion-loading]') ? 1 : 0;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await element.click();
    await expect(page.getByTestId('editor-stage')).toHaveAttribute('data-shown', 'true', { timeout: 15_000 });
    await page.waitForTimeout(1000);

    expect(await page.evaluate(() => (window as unknown as { __loading: number }).__loading), 'frames showing the loading state').toBe(0);
    expect(fetched, 'session or preview requests while reopening').toEqual([]);
  });
});
