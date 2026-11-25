import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const SHOTS = process.env.SHOTS!;
mkdirSync(SHOTS, { recursive: true });

const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page, frame } = panel;
const shot = (name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`) });
const inFocus = frame.frameLocator('#feega-focus');
const field = (name: string) => page.locator(`[data-testid=component-props] [data-field=${name}]`);

await panel.pickAt('button');
await page.waitForTimeout(500);
await page.keyboard.press('f');
await inFocus.locator('button').first().waitFor({ timeout: 8000 });
await field('size').waitFor({ timeout: 8000 });
await page.waitForTimeout(600);
await shot('1-controls');
assert.equal(await inFocus.locator('button').count(), 1, 'one real instance');
assert.equal(await field('size').inputValue(), 'lg', 'starts with the props of the instance on the page');
assert.equal(await inFocus.locator('button').first().innerText(), 'Save changes');

await field('size').selectOption('sm');
await field('label').fill('Hello');
await field('label').press('Enter');
await field('label').blur();
await page.waitForTimeout(500);
assert.equal(await inFocus.locator('button').first().innerText(), 'Hello');
assert.equal(await inFocus.locator('button').first().evaluate((el) => getComputedStyle(el).fontSize), '12px');
await shot('2-props-changed');

await page.locator('[data-testid=variants-toggle]').click();
await page.waitForTimeout(800);
const cells = await inFocus.locator('[data-feega-variant]').count();
assert.ok(cells > 1 && cells <= 24, `variants grid has ${cells} cells`);
await shot('3-variants-grid');
console.log('variants note:', await page.locator('[data-testid=variants-note]').innerText());

await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await panel.pickAt('main span');
await page.waitForTimeout(500);
await page.keyboard.press('f');
await inFocus.locator('span').first().waitFor({ timeout: 8000 });
await field('tone').waitFor({ timeout: 8000 });
await page.waitForTimeout(800);
await shot('4-provider-controls');
assert.equal(await inFocus.locator('span').first().innerText(), 'New', 'rendered with the ThemeProvider of main.tsx');
const badge = (await inFocus.locator('span').first().boundingBox())!;
await page.mouse.click(badge.x + 4, badge.y + 4);
await page.waitForTimeout(600);
const sizeField = page.locator('[data-field=font-size] input.value');
await sizeField.fill('30px');
await sizeField.press('Enter');
await page.waitForTimeout(2500);
await shot('5-edit-in-mount');
let size = '';
for (let i = 0; i < 30 && size !== '30px'; i++) {
  size = await inFocus.locator('span').first().evaluate((el) => getComputedStyle(el).fontSize).catch(() => '');
  await page.waitForTimeout(250);
}
assert.equal(size, '30px', 'the edit reached the source and HMR updated the mount');

await page.keyboard.press('Escape');
await page.waitForTimeout(500);
await panel.pickAt('aside h3');
await page.waitForTimeout(500);
await page.keyboard.press('f');
await page.locator('[data-testid=focus-notice]').waitFor({ timeout: 8000 });
await page.waitForTimeout(800);
await shot('6-fallback');
assert.match(await page.locator('[data-testid=focus-notice]').innerText(), /Couldn't render in isolation: showing a snapshot/);
assert.equal(await inFocus.locator('h3').innerText(), 'Inside the app');

await panel.close();
process.exit(0);
