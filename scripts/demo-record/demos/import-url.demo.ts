import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { openCanvas, SETTLE_MS } from './seed';

const SITE = 'https://vercel.com';
const PAGE_WIDTH = 1280;
const HERO_WIDTH_PX = 1480;
const LEFT_PX = 60;
const TEST_MS = 1_800_000;
const IMPORT_MS = 240_000;
const SCREEN = { x: 0, y: 0, width: 1600, height: 900 };
const READ_MS = 2400;
const ZOOM_STEP = -60;
const BLUE = '0070F3';

const TITLE = { x: 100, y: 340 };
const BUTTON = { x: 86, y: 459 };

const importedFrame = (page: Page): Locator => page.locator('[data-testid="frame-overlays"] [data-frame]').first();

async function onPage(frame: Locator, at: { x: number; y: number }) {
  const box = (await frame.boundingBox())!;
  const k = box.width / PAGE_WIDTH;
  return { x: box.x + at.x * k, y: box.y + at.y * k };
}

async function zoomOnHero(page: Page, frame: Locator) {
  for (let i = 0; i < 40; i++) {
    const box = (await frame.boundingBox())!;
    if (box.width >= HERO_WIDTH_PX) {
      break;
    }
    const k = box.width / PAGE_WIDTH;
    await page.mouse.move(box.x + 640 * k, box.y + 120 * k);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, ZOOM_STEP);
    await page.keyboard.up('Control');
    await page.waitForTimeout(120);
  }
  const box = (await frame.boundingBox())!;
  await page.mouse.move(800, 450);
  await page.mouse.wheel(box.x - LEFT_PX, box.y - 70);
  await page.waitForTimeout(SETTLE_MS);
}

test('import from url', async ({ page, session }) => {
  test.setTimeout(TEST_MS);
  await installCursor(page);
  await openCanvas(page, session);

  await recordDemo(page, { slug: 'import-url', title: 'import any page' }, async (d) => {
    await d.skip(async () => {
      await page.goto(SITE, { waitUntil: 'load' });
      await page.waitForTimeout(3000);
    });
    await d.look(SCREEN, READ_MS);
    await d.skip(() => openCanvas(page, session));

    await d.click(page.getByTestId('insert-open'));
    await d.click(page.getByTestId('insert-menu').locator('[data-insert="url"]'));
    await expect(page.getByTestId('url-import-dialog')).toBeVisible();
    await d.type(page.getByTestId('url-import-url'), SITE);
    await d.click(page.getByTestId('url-import-run'));
    await d.wait(1200);

    const frame = importedFrame(page);
    await d.skip(async () => {
      await expect(page.getByTestId('url-import-dialog')).toBeHidden({ timeout: IMPORT_MS });
      await expect(frame).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(6000);
      await page.keyboard.press('Shift+Digit1');
      await page.waitForTimeout(SETTLE_MS);
    });
    await d.look((await frame.boundingBox())!, READ_MS);

    await d.skip(() => zoomOnHero(page, frame));
    await d.look(SCREEN, READ_MS);

    const title = await onPage(frame, TITLE);
    await page.keyboard.down('Meta');
    await d.click(title);
    await page.keyboard.up('Meta');
    await d.click(page.getByTestId('motion-inspector').locator('textarea').first());
    await page.keyboard.press('Meta+A');
    await d.type(null, 'Infrastructure for agents');
    await page.keyboard.press('Escape');
    await d.wait(1200);

    const button = await onPage(frame, BUTTON);
    await page.keyboard.down('Meta');
    await d.click(button);
    await page.keyboard.up('Meta');
    const stack = page.getByTestId('motion-inspector').getByTestId('fill-stack').first();
    await expect(stack.getByTestId('fill-row').first()).toBeVisible({ timeout: 15_000 });
    await d.click(stack.getByTestId('fill-row').first().getByTestId('fill-swatch'));
    const editor = page.getByTestId('fill-editor');
    await expect(editor).toBeVisible();
    const hex = editor.getByTestId('colour-channel').first();
    await hex.click({ clickCount: 3 });
    await d.type(hex, BLUE, { click: false });
    await page.keyboard.press('Enter');
    await d.wait(1600);
    await page.keyboard.press('Escape');

    await d.click(page.getByRole('button', { name: 'Components' }).first());
    const panel = page.getByTestId('canvas-components');
    await expect(panel.getByTestId('component-row').first()).toBeVisible({ timeout: 15_000 });
    await d.wait(3000);
    await d.look((await panel.boundingBox())!, READ_MS);

    await d.click(page.getByTestId('editor-mode-switch').locator('[data-mode=code]'));
    const code = page.getByTestId('dev-code');
    await expect(code).toBeVisible({ timeout: 30_000 });
    await d.look((await code.boundingBox())!, READ_MS);
  });
});
