import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const SHOTS = join(homedir(), 'Documents/feega-videos/shots/inspect');
const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;
const crumbs = () => page.locator('aside [data-testid=breadcrumb]').innerText();

await panel.pickAt('.lead');
await page.waitForTimeout(300);
const start = await crumbs();
await page.screenshot({ path: join(SHOTS, '13-breadcrumb.png') });

await page.locator('body').press('Escape');
await page.waitForTimeout(300);
const parent = await crumbs();
await page.locator('body').press('Enter');
await page.waitForTimeout(300);
const child = await crumbs();
await page.locator('body').press('Tab');
await page.waitForTimeout(300);
const next = await crumbs();
await page.screenshot({ path: join(SHOTS, '14-breadcrumb-sibling.png') });

console.log({ start, parent, child, next });
assert.notEqual(parent, start, 'Esc selects the parent');
assert.notEqual(next, child, 'Tab moves to the next sibling');
await panel.close();
