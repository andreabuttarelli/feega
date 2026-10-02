import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];
const TOLERANCE_PX = 1;
const SHOTS = process.env.E2E_SHOTS_DIR;

async function expectFlowFillsItsCanvas(page: Page): Promise<void> {
  const flow = page.locator('.svelte-flow').first();
  await expect(flow).toBeVisible();

  const [flowBox, canvasBox] = await Promise.all([flow.boundingBox(), page.locator('.canvas').first().boundingBox()]);
  if (!flowBox || !canvasBox) {
    throw new Error('canvas or flow has no bounding box');
  }

  expect(Math.abs(flowBox.x - canvasBox.x)).toBeLessThanOrEqual(TOLERANCE_PX);
  expect(Math.abs(flowBox.width - canvasBox.width)).toBeLessThanOrEqual(TOLERANCE_PX);
  expect(Math.abs(flowBox.height - canvasBox.height)).toBeLessThanOrEqual(TOLERANCE_PX);
  expect(canvasBox.x).toBeLessThanOrEqual(TOLERANCE_PX);
}

test.describe('canvas full bleed @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  for (const viewport of VIEWPORTS) {
    test(`la tela resta a filo dopo il changelog e ritorno (${viewport.name})`, async ({ page, session }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const canvasPath = `/p/${session.projectId}/c/${session.canvasId}`;
      await gotoHydrated(page, canvasPath);
      await expectFlowFillsItsCanvas(page);

      await page.getByRole('button', { name: 'Menu', exact: true }).click();
      await page.getByRole('menuitem', { name: 'Changelog' }).click();
      await page.waitForURL('**/changelog');
      await page.goBack();
      await page.waitForURL(`**${canvasPath}`);
      await expect(page.locator('.svelte-flow').first()).toBeVisible();
      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/${viewport.name}.png` });
      }

      await expectFlowFillsItsCanvas(page);
    });
  }
});
