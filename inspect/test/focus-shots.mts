import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const SHOTS = process.env.SHOTS!;
const CARD = process.env.FOCUS_CARD ?? 'article h2';
const TITLE = process.env.FOCUS_TITLE ?? 'article h2';
const COMPONENT = process.env.FOCUS_COMPONENT ?? 'PlanCard';
const NEW_SIZE = process.env.FOCUS_SIZE ?? '34px';
mkdirSync(SHOTS, { recursive: true });

const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page, frame } = panel;
const tabs = page.locator('[data-testid=focus-tabs]');
const shot = (name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`) });
const inFocus = frame.frameLocator('#feega-focus');
const sizeInFocus = (selector: string) => frame.locator('#feega-focus').evaluate((f, sel) => getComputedStyle((f as HTMLIFrameElement).contentDocument!.querySelector(sel)!).fontSize, selector);
const sizeInPage = (selector: string) => frame.locator(selector).first().evaluate((el) => getComputedStyle(el).fontSize);
await panel.pickAt(CARD);
await page.waitForTimeout(500);
await shot('1-page-tab');

await page.keyboard.press('f');
await tabs.waitFor({ timeout: 5000 });
await inFocus.locator(TITLE).first().waitFor({ timeout: 8000 }).catch(async (error) => {
  await shot('2-focus-failed');
  console.log('focus iframe', await frame.locator('#feega-focus').evaluate((f) => (f as HTMLIFrameElement).contentDocument?.documentElement.outerHTML.slice(0, 1500)));
  throw error;
});
await page.waitForTimeout(800);
await shot('2-focus-tab');
assert.equal(await page.locator('[data-testid=tab-focus]').innerText(), COMPONENT);
assert.equal(await inFocus.locator(TITLE).count(), 1, 'one instance, nothing else');
assert.equal(await inFocus.locator('footer, header, nav').count(), 0, 'nothing else of the page');

const mounted = (await page.locator('[data-testid=component-props]').count()) > 0;
console.log('mode', mounted ? 'mount' : 'snapshot');
if (process.env.FOCUS_EXPECT) {
  assert.equal(mounted ? 'mount' : 'snapshot', process.env.FOCUS_EXPECT);
}
if (mounted && process.env.FOCUS_PROP) {
  const prop = page.locator(`[data-field=${process.env.FOCUS_PROP}]`);
  await prop.fill('Edited name');
  await prop.press('Enter');
  await page.waitForTimeout(600);
  assert.ok((await inFocus.locator(TITLE).first().innerText()).includes('Edited name'), 'a prop control changes the component');
  await page.locator('[data-testid=variants-toggle]').click();
  await page.waitForTimeout(800);
  await shot('2b-variants');
  assert.ok((await inFocus.locator('[data-feega-variant]').count()) > 1, 'variants render');
  await page.locator('[data-testid=variants-toggle]').click();
  await page.waitForTimeout(600);
}

const rows = await page.locator('[data-testid=layers] [data-layer]').allInnerTexts();
console.log('layers', JSON.stringify(rows));
assert.ok(!rows.some((row) => ['html', 'body'].includes(row.trim())), 'no html or body rows');
assert.ok(rows.length > 0, 'the tree starts at the component');
console.log('component row', rows.some((row) => row.includes(COMPONENT)), 'mount badge', await page.locator('[data-testid=focus-controls], [data-testid=variants]').count());
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
const written = execSync(`grep -rl --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.nuxt --exclude-dir=.react-router --exclude-dir=.svelte-kit "font-size: ${NEW_SIZE}" . || true`, { cwd: process.env.INSPECT_APP_ROOT, encoding: 'utf8' });
assert.ok(written.trim(), 'the edit reached the source');
const shown = await sizeInFocus(TITLE);
assert.ok([NEW_SIZE, await sizeInPage(TITLE)].includes(shown), 'the focus tab shows the edit, or what the page shows');

await page.locator('[data-testid=tab-page]').click();
await page.waitForTimeout(800);
await shot('5-page-tab-after-edit');
assert.equal(await sizeInPage(TITLE), shown, 'the page and the focus tab agree');
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
