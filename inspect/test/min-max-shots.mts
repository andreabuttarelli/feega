import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const APP_ROOT = process.env.INSPECT_APP_ROOT!;
const SOURCE = join(APP_ROOT, 'src/App.svelte');
const SHOTS = join(homedir(), 'Documents/feega-videos/min-max');
const SETTLE_MS = 1500;

await mkdir(SHOTS, { recursive: true });
const panel = await openPanel(APP_ROOT);
const { page } = panel;

await panel.pickAt('#card');
const toggle = page.locator('[data-field=size-limits]');
if ((await toggle.getAttribute('aria-expanded')) === 'false') {
  await toggle.click();
}
await page.locator('[data-testid=breakpoint-badge]').click();
await page.locator('[data-breakpoint-item=md]').click();

const field = page.locator('[data-field=max-width] input.value');
await field.fill('720px');
await field.press('Enter');
await page.waitForTimeout(SETTLE_MS);

const written = await readFile(SOURCE, 'utf8');
assert.match(written, /class="[^"]*\bmd:max-w-\[720px\]/);
console.log('ok max-width at md written');

const bar = (await page.locator('aside.right').boundingBox())!;
await page.screenshot({ path: join(SHOTS, 'min-max-size.png'), clip: { x: bar.x, y: 0, width: bar.width, height: Math.min(900, bar.height) } });
await panel.close();
process.exit(0);
