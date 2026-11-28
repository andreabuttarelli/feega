import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openPanel } from './harness.mts';

const SHOT = process.env.SHOT!;
const PANELS = ['aside.left', 'aside.right', 'header.toolbar'];
mkdirSync(dirname(SHOT), { recursive: true });

const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;

const hidden = async () => {
  for (const selector of PANELS) {
    assert.equal(await page.locator(selector).isVisible(), false, `${selector} is hidden`);
  }
};
const shown = async () => {
  for (const selector of PANELS) {
    assert.equal(await page.locator(selector).isVisible(), true, `${selector} is back`);
  }
};

await page.locator('[data-testid="pages-tab"]').click();
await page.locator('[data-testid="canvas-open-pages"]').click();
const pages = page.locator('[data-testid="pages-canvas"]');
await pages.waitFor();
await page.waitForTimeout(1500);
await hidden();
const box = await pages.boundingBox();
assert.equal(box!.y, (await page.locator('main').boundingBox())!.y, 'the pages canvas starts at the top of the area');
assert.equal(box!.width, 1440, 'the pages canvas fills the width');
await page.screenshot({ path: SHOT.replace(/\.png$/, '-pages.png') });

await page.locator('[data-testid="canvas-frame"] [data-testid="canvas-open"]:not([disabled])').first().click();
await pages.waitFor({ state: 'detached' });
await shown();

await page.locator('[data-testid="components-tab"]').click();
await page.locator('[data-testid="canvas-open-components"]').click();
const components = page.locator('[data-testid="components-canvas"]');
await components.waitFor();
await page.waitForTimeout(1500);
await hidden();
await page.screenshot({ path: SHOT.replace(/\.png$/, '-components.png') });

await page.locator('[data-testid="canvas-frame"] [data-testid="canvas-open"]').first().click();
await components.waitFor({ state: 'detached' });
await shown();

await panel.close();
