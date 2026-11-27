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
assert.deepEqual(routes, ['/', '/about']);
assert.equal(await page.locator('[data-testid="page-row"][data-route="/"]').getAttribute('aria-current'), 'page');

const groups = await page.locator('[data-testid="page-group"]').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.route));
assert.deepEqual(groups, ['/blog/[slug]', '/docs/[...rest]']);

const blog = page.locator('[data-testid="page-group"][data-route="/blog/[slug]"]');
await blog.locator('[data-testid="page-example"]').first().waitFor();
const found = await blog.locator('[data-testid="page-example"]').evaluateAll((rows) => rows.map((r) => (r as HTMLElement).dataset.path));
assert.deepEqual(found, ['/blog/primo-post', '/blog/ciao-mondo']);

const docs = page.locator('[data-testid="page-group"][data-route="/docs/[...rest]"]');
assert.equal(await docs.locator('[data-testid="page-example"]').count(), 0);
await docs.locator('[data-testid="example-input"][data-param="rest"]').fill('guide/start');
await docs.locator('[data-testid="example-input"]').press('Enter');
await docs.locator('[data-testid="page-example"][data-path="/docs/guide/start"]').waitFor();
assert.equal(await docs.locator('[data-testid="example-field"]').count(), 0);

await page.screenshot({ path: SHOT.replace(/\.png$/, '-list.png') });

await blog.locator('[data-testid="page-example"][data-path="/blog/ciao-mondo"]').click();
await blog.locator('[data-testid="page-example"][data-path="/blog/ciao-mondo"][aria-current="page"]').waitFor();

await page.locator('[data-testid="page-row"][data-route="/about"]').click();
await page.locator('[data-testid="page-row"][data-route="/about"][aria-current="page"]').waitFor();

await page.screenshot({ path: SHOT });
await panel.close();
