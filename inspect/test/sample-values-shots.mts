import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { openPanel } from './harness.mts';

const SHOTS = join(homedir(), 'Documents/feega-videos/shots/random-values');
mkdirSync(SHOTS, { recursive: true });

const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;

await page.locator('[data-testid="pages-tab"]').click();
const field = page.locator('[data-testid="example-field"]').first();
await field.waitFor();
await field.locator('[data-testid="sample-trigger"]').first().click();
await page.locator('[data-testid="sample-item"]').first().waitFor();
const routeIds = await page.locator('[data-testid="sample-item"]').evaluateAll((items) => items.map((i) => (i as HTMLElement).dataset.sample));
assert.deepEqual(routeIds, ['uuid', 'short-id', 'slug', 'number', 'not-found']);
await page.screenshot({ path: join(SHOTS, 'pages-field.png') });

await page.locator('[data-sample="slug"]').click();
await page.waitForTimeout(1500);
console.log('route opened', await page.locator('[data-testid="canvas-open-pages"], [data-testid="page-row"]').count());

await page.locator('[data-testid="components-tab"]').click();
await page.locator('[data-testid="component-folder"]').first().waitFor();
await page.locator('[data-testid="components"] [aria-expanded="false"]').evaluateAll((folders) => folders.forEach((f) => (f as HTMLElement).click()));
await page.locator('[data-testid="component-expand"]').first().waitFor();
await page.locator('[data-testid="component-expand"]').first().click();
await page.locator('[data-testid="prop-field"][type="text"]').first().waitFor();
await page.locator('[data-testid="prop-fields"] [data-testid="sample-trigger"]').first().click();
await page.locator('[data-testid="sample-item"]').first().waitFor();
await page.screenshot({ path: join(SHOTS, 'component-prop.png') });
await page.locator('[data-testid="sample-item"]').first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: join(SHOTS, 'component-prop-applied.png') });

await panel.close();
process.exit(0);
