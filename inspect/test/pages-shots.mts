import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openPanel } from './harness.mts';

const SHOT = process.env.SHOT!;
mkdirSync(dirname(SHOT), { recursive: true });

const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;

await page.locator('[data-testid="pages-tab"]').click();
await page.locator('[data-testid="page-row"]').first().waitFor();
const routes = await page.locator('[data-testid="page-row"]').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.route));
assert.deepEqual(routes, ['/', '/about', '/blog/[slug]']);
assert.equal(await page.locator('[data-testid="page-row"][data-route="/"]').getAttribute('aria-current'), 'page');
assert.equal(await page.locator('[data-testid="page-row"][data-route="/blog/[slug]"]').isDisabled(), true);

await page.locator('[data-testid="page-row"][data-route="/about"]').click();
await page.locator('[data-testid="page-row"][data-route="/about"][aria-current="page"]').waitFor();

await page.screenshot({ path: SHOT });
await panel.close();
