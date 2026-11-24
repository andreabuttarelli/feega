import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const SHOTS = process.env.SHOTS!;
const CARD = process.env.FOCUS_CARD ?? 'article h2';
const COMPONENT = process.env.FOCUS_COMPONENT ?? 'PlanCard';
mkdirSync(SHOTS, { recursive: true });

const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page, frame } = panel;
const bar = page.locator('[data-testid=focus-bar]');
const shot = (name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`) });
const dimmed = () => frame.locator('#feega-focus').count();

await panel.pickAt(CARD);
await page.waitForTimeout(500);
await shot('1-selected');

await page.keyboard.press('f');
await bar.waitFor({ timeout: 5000 });
await page.waitForTimeout(600);
await shot('2-focused-all-instances');
console.log('label', await page.locator('[data-testid=focus-label]').innerText());
assert.equal(await dimmed(), 1, 'the page is dimmed');
assert.match(await page.locator('[data-testid=focus-label]').innerText(), new RegExp(`${COMPONENT} · 3 instances`));

await page.keyboard.press('Escape');
await page.waitForTimeout(400);
assert.equal(await bar.count(), 0, 'Esc leaves the focus');
assert.equal(await dimmed(), 0, 'the dimming is gone');
await shot('3-exited');

const row = page.locator('[data-layer]', { has: page.locator('.name.component', { hasText: COMPONENT }) });
for (let i = 0; i < 12 && !(await row.count()); i++) {
  const twists = page.locator('[aria-label=Expand]');
  if (!(await twists.count())) {
    break;
  }
  await twists.first().click();
  await page.waitForTimeout(150);
}
await row.first().dblclick();
await bar.waitFor({ timeout: 5000 });
await page.waitForTimeout(600);
await shot('4-focused-from-layers-row');
console.log('label', await page.locator('[data-testid=focus-label]').innerText());

await page.locator('[data-testid=focus-exit]').click();
await page.waitForTimeout(300);
assert.equal(await dimmed(), 0);

await panel.close();
