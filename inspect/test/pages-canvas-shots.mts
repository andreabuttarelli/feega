import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openPanel } from './harness.mts';

const SHOT = process.env.SHOT!;
const SHOT_AFTER = process.env.SHOT_AFTER ?? SHOT.replace(/\.png$/, '-after.png');
mkdirSync(dirname(SHOT), { recursive: true });

const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;

await page.locator('[data-testid="pages-tab"]').click();
await page.locator('[data-testid="canvas-open-pages"]').click();
await page.locator('[data-testid="pages-canvas"]').waitFor();

const frames = page.locator('[data-testid="canvas-frame"]');
assert.equal(await frames.count(), 9);
assert.deepEqual(
  await page.locator('[data-testid="canvas-row"]').evaluateAll((rows) => rows.map((r) => r.firstChild?.textContent)),
  ['/', '/about', '/blog/[slug]']
);

const live = () => page.locator('[data-testid="canvas-frame"][data-live="true"]').count();
await page.waitForTimeout(4000);
assert.ok((await live()) <= 6, 'live frames stay under the cap');
assert.equal(await page.locator('[data-testid="canvas-frame"] iframe').count() <= 12, true);
assert.equal(await page.locator('[data-testid="canvas-frame"][data-key^="/blog"] iframe').count(), 0);

await page.screenshot({ path: SHOT });

const percent = () => page.locator('[data-testid="canvas-percent"]').textContent();
const fitted = await percent();
await page.locator('[data-testid="pages-canvas"]').hover();
await page.keyboard.down('Control');
await page.mouse.wheel(0, -300);
await page.keyboard.up('Control');
await page.waitForTimeout(200);
assert.notEqual(await percent(), fitted, 'ctrl+wheel zooms');

await page.locator('[data-testid="canvas-fit"]').click();
assert.equal(await percent(), fitted, 'fit restores the fitted view');

const before = await page.locator('[data-testid="canvas-frame"]').first().boundingBox();
await page.mouse.wheel(0, 120);
await page.waitForTimeout(100);
const after = await page.locator('[data-testid="canvas-frame"]').first().boundingBox();
assert.ok(after!.y < before!.y, 'plain wheel pans');

await page.locator('[data-testid="canvas-fit"]').click();
await page.locator('[data-testid="canvas-frame"][data-key="/about::phone"] [data-testid="canvas-open"]').click();
await page.locator('[data-testid="pages-canvas"]').waitFor({ state: 'detached' });
await page.locator('[data-testid="page-row"][data-route="/about"][aria-current="page"]').waitFor();
await page.waitForTimeout(1500);
await page.screenshot({ path: SHOT_AFTER });

await panel.close();
