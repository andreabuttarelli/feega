import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { openPanel } from './harness.mts';

const SHOTS = join(homedir(), 'Documents/feega-videos/shots/custom-slug');
const GROUP = '[data-testid="page-group"][data-route="/alternatives/[slug=alternative]"]';
mkdirSync(SHOTS, { recursive: true });

const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;

await page.locator('[data-testid="pages-tab"]').click();
const group = page.locator(GROUP);
await group.waitFor();
const row = group.locator('[data-testid="custom-row"]');
await row.waitFor();
assert.equal(await row.innerText(), 'Custom slug');
await group.screenshot({ path: join(SHOTS, 'collapsed.png') });

await row.click();
const input = group.locator('[data-testid="example-input"]');
await input.waitFor();
assert.equal(await input.getAttribute('placeholder'), 'Type a slug…');
assert.equal(await input.evaluate((el) => el === document.activeElement), true);
await group.locator('[data-testid="sample-trigger"]').click();
await page.locator('[data-testid="sample-item"]').first().waitFor();
await page.screenshot({ path: join(SHOTS, 'expanded-dice.png') });
await page.keyboard.press('Escape');

await input.fill('my-custom-slug');
await input.press('Enter');
await group.locator('[data-path="/alternatives/my-custom-slug"]').waitFor();
await group.locator('[data-testid="custom-row"]').waitFor();
await group.screenshot({ path: join(SHOTS, 'added.png') });

await group.locator('[data-testid="custom-row"]').click();
await input.waitFor();
await input.press('Escape');
await group.locator('[data-testid="custom-row"]').waitFor();

await panel.close();
process.exit(0);
