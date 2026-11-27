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
await page.locator('[data-testid="page-example"]').first().waitFor();
await page.locator('[data-testid="canvas-open-pages"]').click();
await page.locator('[data-testid="pages-canvas"]').waitFor();

const frames = page.locator('[data-testid="canvas-frame"]');
assert.equal(await frames.count(), 12);
assert.deepEqual(
  await page.locator('[data-testid="canvas-row"]').evaluateAll((rows) => rows.map((r) => r.firstChild?.textContent)),
  ['/', '/about', '/blog/[slug]', '/docs/[...rest]']
);
assert.equal(await page.locator('[data-testid="canvas-example"]').first().textContent(), 'primo-post');

const live = () => page.locator('[data-testid="canvas-frame"][data-live="true"]').count();
await page.waitForTimeout(4000);
assert.ok((await live()) <= 6, 'live frames stay under the cap');
assert.equal(await page.locator('[data-testid="canvas-frame"] iframe').count() <= 12, true);
assert.equal(await page.locator('[data-testid="canvas-frame"][data-key^="/docs"] iframe').count(), 0);
const srcPath = (selector: string) => page.locator(selector).first().getAttribute('src').then((src) => new URL(src!).pathname);
assert.equal(await srcPath('[data-testid="canvas-frame"][data-key^="/blog"] iframe'), '/blog/primo-post');

const docsInput = page.locator('[data-testid="canvas-frame"][data-key="/docs/[...rest]::desktop"] [data-testid="example-input"]');
assert.equal(await docsInput.count(), 1);

await page.screenshot({ path: SHOT });

await docsInput.fill('guide/start');
await docsInput.press('Enter');
await docsInput.waitFor({ state: 'detached' });
assert.equal(await page.locator('[data-testid="canvas-example"]').last().textContent(), 'guide/start');
assert.equal(await page.locator('[data-testid="canvas-frame"][data-key^="/docs"] [data-testid="canvas-open"]').first().isDisabled(), false);
await page.screenshot({ path: SHOT.replace(/\.png$/, '-typed.png') });

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
