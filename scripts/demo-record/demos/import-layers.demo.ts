import type { Locator, Page } from '@playwright/test';
import sharp from 'sharp';
import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import type { Demo } from '../demo';
import { openCanvas, SETTLE_MS } from './seed';

const SITE = process.env.DEMO_SITE ?? 'https://vercel.com';
const TEST_MS = 1_800_000;
const IMPORT_MS = 400_000;
const HOLD_MS = 2400;
const SECTION_DEPTH_PX = '44px';
const SECTIONS = [1, 3];
const FOLD_LIMIT = 40;
const DARK_LUMA = 96;
const SCREEN = { x: 0, y: 0, width: 1600, height: 900 };
const CANVAS_AREA = { x: 440, y: 60, width: 1010, height: 780 };
const CODE_MODE = 3;
const COMPONENTS = 'Components';
const INSTANCE = process.env.DEMO_INSTANCE ?? 'Get a Demo';

type Rect = { x: number; y: number; width: number; height: number };

const importedFrame = (page: Page): Locator => page.locator('[data-testid="frame-overlays"] [data-frame]').first();
const box = async (l: Locator) => (await l.boundingBox())!;
const top = (r: Rect, share: number): Rect => ({ ...r, height: r.height * share });

const around = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
};

const OUTER_DEPTHS_PX = ['20px', '32px'];

async function foldSections(layers: Locator) {
  for (const depth of OUTER_DEPTHS_PX) {
    const shut = layers.locator(`[data-layer][style*="padding-left: ${depth}"] [data-testid="layer-fold"][aria-expanded="false"]`).first();
    if (await shut.count()) {
      await shut.click();
      await layers.page().waitForTimeout(300);
    }
  }
  for (let i = 0; i < FOLD_LIMIT; i++) {
    const open = layers.locator(`[data-layer][style*="padding-left: ${SECTION_DEPTH_PX}"] [data-testid="layer-fold"][aria-expanded="true"]`).first();
    if (!(await open.count())) {
      return;
    }
    await open.click();
    await layers.page().waitForTimeout(500);
    await layers.evaluate((el) => el.scrollBy(0, 1));
    await layers.evaluate((el) => el.scrollBy(0, -1));
    await layers.page().waitForTimeout(200);
  }
}

async function reopen(page: Page, href: string, ready: Locator) {
  await page.goto(href);
  await expect(ready).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(SETTLE_MS * 2);
  await page.keyboard.press('Shift+Digit1');
  await page.waitForTimeout(SETTLE_MS);
}

async function schemeOf(page: Page, frame: Locator): Promise<'dark' | 'light'> {
  const shot = await page.screenshot({ clip: await box(frame) });
  const { channels } = await sharp(shot).stats();
  const luma = (channels[0].mean + channels[1].mean + channels[2].mean) / 3;
  return luma < DARK_LUMA ? 'dark' : 'light';
}

test('import from url, the result', async ({ page, session }) => {
  test.setTimeout(TEST_MS);
  await installCursor(page);
  await openCanvas(page, session);
  const canvasUrl = page.url();

  const flow = async (d: Demo) => {
    const layers = page.getByTestId('layers');
    const layersButton = page.getByRole('button', { name: 'Layers', exact: true });
    const sections = layers.locator(`[data-layer][style*="padding-left: ${SECTION_DEPTH_PX}"]`);
    const hold = (r: Rect) => d.look(r, HOLD_MS);
    const frame = importedFrame(page);

    await d.click(page.getByTestId('insert-open'));
    await d.click(page.getByTestId('insert-menu').locator('[data-insert="url"]'));
    await expect(page.getByTestId('url-import-dialog')).toBeVisible();
    await d.type(page.getByTestId('url-import-url'), SITE);
    await d.click(page.getByTestId('url-import-run'));
    await d.wait(1500);

    await d.cut(async () => {
      await expect(page.getByTestId('url-import-dialog')).toBeHidden({ timeout: IMPORT_MS });
      await expect(frame).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(8000);
      await page.keyboard.press('Shift+Digit1');
      await page.waitForTimeout(SETTLE_MS);
    });
    await hold(await box(frame));
    const scheme = await schemeOf(page, frame);

    if (!(await layers.isVisible())) {
      await d.click(layersButton);
    }
    const components = page.locator('.page-link', { hasText: COMPONENTS });
    const home = page.locator('.page-link').first();
    const homeLink = (await home.getAttribute('href'))!;
    const componentsLink = (await components.getAttribute('href'))!;
    await d.cut(async () => {
      await foldSections(layers);
      await page.waitForTimeout(600);
    });
    await hold(top(await box(layers), 0.5));

    for (const at of SECTIONS) {
      await d.click(sections.nth(at));
      await d.key('Shift+Digit2', '⇧2');
      await d.wait(1000);
      await hold(CANVAS_AREA);
    }

    await d.click(sections.nth(SECTIONS[0]).getByTestId('layer-fold'));
    await hold(top(await box(layers), 0.6));

    await d.cut(async () => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(SITE, { waitUntil: 'load' });
      await page.waitForTimeout(3000);
    });
    await hold(SCREEN);
    await d.cut(async () => {
      await page.emulateMedia({ colorScheme: 'light' });
      await reopen(page, canvasUrl, frame);
    });

    const sets = page.getByTestId('component-set-outline');
    if (!(await components.isVisible())) {
      await d.click(layersButton);
    }
    await d.click(components);
    await d.cut(() => reopen(page, componentsLink, sets.first()));
    await hold(CANVAS_AREA);
    await hold(around(await box(sets.nth(0)), await box(sets.nth(1))));

    if (!(await home.isVisible())) {
      await d.click(layersButton);
    }
    await d.click(home);
    await d.cut(async () => {
      await reopen(page, homeLink, frame);
      if (!(await layers.isVisible())) {
        await layersButton.click();
      }
      await expect(layers.locator('[data-layer]').first()).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(SETTLE_MS);
    });
    const instance = layers.locator('[data-layer][data-highlight="component"]', { hasText: INSTANCE }).first();
    await d.click(page.getByTestId('layers-search-toggle'));
    await d.type(page.getByTestId('layers-search'), INSTANCE);
    await expect(instance).toBeVisible({ timeout: 15_000 });
    await d.click(instance);
    await d.key('Shift+Digit2', '⇧2');
    const goMain = page.getByTestId('instance-go-main');
    await expect(goMain).toBeVisible({ timeout: 15_000 });
    await hold(CANVAS_AREA);
    await d.move(goMain);
    await hold(top(await box(page.getByTestId('motion-inspector')), 0.3));

    await d.click(page.getByTestId('editor-mode-switch').locator('[role="radio"]').nth(CODE_MODE));
    const code = page.getByTestId('dev-code');
    await expect(code).toBeVisible({ timeout: 30_000 });
    await d.wait(1500);
    await hold(await box(code));
  };

  await recordDemo(page, { slug: 'import-layers-v2', title: 'import from url' }, flow);
});
