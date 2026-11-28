import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openPanel } from './harness.mts';

const SHOT = process.env.SHOT!;
const SHOT_CANVAS = process.env.SHOT_CANVAS ?? SHOT.replace(/\.png$/, '-canvas.png');
const SHOT_FOCUS = process.env.SHOT_FOCUS ?? SHOT.replace(/\.png$/, '-focus.png');
const SHOT_PAGES = process.env.SHOT_PAGES ?? SHOT.replace(/\.png$/, '-pages.png');
mkdirSync(dirname(SHOT), { recursive: true });

const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;

await page.locator('[data-testid="pages-tab"]').click();
await page.locator('[data-testid="canvas-open-pages"]').waitFor();
await page.screenshot({ path: SHOT_PAGES });

await page.locator('[data-testid="components-tab"]').click();
await page.locator('[data-testid="component-folder"]').first().waitFor();
await page.locator('[data-testid="components"] [aria-expanded="false"]').evaluateAll((folders) => folders.forEach((f) => (f as HTMLElement).click()));
await page.locator('[data-testid="component-row"]').first().waitFor();
const names = await page.locator('[data-testid="component-row"]').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.name));
assert.ok(names.includes('Button') && names.includes('Card') && names.includes('Avatar'), 'lists the components');
assert.ok((await page.locator('[data-testid="component-folder"]').count()) > 0, 'nested in folders');
await page.screenshot({ path: SHOT });

await page.locator('[data-testid="canvas-open-components"]').click();
await page.locator('[data-testid="components-canvas"]').waitFor();
await page.waitForTimeout(6000);
assert.equal(await page.locator('[data-testid="canvas-frame"]').count(), names.length);
assert.ok((await page.locator('[data-testid="canvas-frame"][data-live="true"]').count()) <= 6, 'live frames stay under the cap');
await page.screenshot({ path: SHOT_CANVAS });

await page.locator('[data-testid="canvas-frame"][data-key$="::Card"] [data-testid="canvas-open"]').click();
await page.locator('[data-testid="components-canvas"]').waitFor({ state: 'detached' });
await page.waitForTimeout(3000);
await page.screenshot({ path: SHOT_FOCUS });

await panel.close();
