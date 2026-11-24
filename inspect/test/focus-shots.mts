import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const SHOTS = process.env.SHOTS!;
const CARD = process.env.FOCUS_CARD ?? 'article h2';
const TITLE = process.env.FOCUS_TITLE ?? 'article h2';
const COMPONENT = process.env.FOCUS_COMPONENT ?? 'PlanCard';
const INSTANCES = Number(process.env.FOCUS_INSTANCES ?? 3);
const NEW_SIZE = '34px';
mkdirSync(SHOTS, { recursive: true });

const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page, frame } = panel;
const tabs = page.locator('[data-testid=focus-tabs]');
const shot = (name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`) });
const inFocus = frame.frameLocator('#feega-focus');
const sizeOf = async (where: typeof frame) => {
  let size = '';
  for (let i = 0; i < 40 && size !== NEW_SIZE; i++) {
    size = await where.locator(TITLE).first().evaluate((el) => getComputedStyle(el).fontSize).catch(() => '');
    await page.waitForTimeout(250);
  }
  return size;
};

await panel.pickAt(CARD);
await page.waitForTimeout(500);
await shot('1-page-tab');

await page.keyboard.press('f');
await tabs.waitFor({ timeout: 5000 });
await inFocus.locator(TITLE).first().waitFor({ timeout: 5000 });
await page.waitForTimeout(800);
await shot('2-focus-tab');
assert.equal(await page.locator('[data-testid=tab-focus]').innerText(), COMPONENT);
assert.equal(await inFocus.locator(TITLE).count(), INSTANCES, 'every instance of the component, nothing else');
assert.equal(await inFocus.locator('footer, header, nav').count(), 0, 'nothing else of the page');

const title = (await inFocus.locator(TITLE).first().boundingBox())!;
await page.mouse.move(title.x + 4, title.y + 4);
await page.mouse.click(title.x + 4, title.y + 4);
await page.waitForTimeout(600);
await shot('3-selected-in-focus-tab');

const field = page.locator('[data-field=font-size] input.value');
await field.fill(NEW_SIZE);
await field.press('Enter');
await page.waitForTimeout(2500);
await shot('4-edited-in-focus-tab');
assert.equal(await sizeOf(inFocus as never), NEW_SIZE, 'the focus tab shows the edit');

await page.locator('[data-testid=tab-page]').click();
await page.waitForTimeout(800);
await shot('5-page-tab-after-edit');
assert.equal(await sizeOf(frame), NEW_SIZE, 'the page got the same edit from the source');
assert.equal(await page.locator('[data-testid=focus-tabs]').count(), 1, 'the focus tab stays open');

await page.locator('[data-testid=tab-focus]').click();
await page.waitForTimeout(600);
await shot('6-back-to-focus-tab');

await page.keyboard.press('Escape');
await page.waitForTimeout(500);
assert.equal(await tabs.count(), 0, 'Esc closes the focus tab');
assert.equal(await frame.locator('#feega-focus').count(), 0);
await shot('7-closed');

await panel.close();
process.exit(0);
