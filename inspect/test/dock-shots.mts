import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const SHOTS = join(homedir(), 'Documents/feega-videos/toolbar-dock');
mkdirSync(SHOTS, { recursive: true });
const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;
const backdrop = (await page.locator('.backdrop').boundingBox())!;

async function dragBarTo(x: number, y: number) {
  const grip = (await page.locator('.grip').boundingBox())!;
  const from = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(400);
}

const targets: Record<string, { x: number; y: number }> = {
  bottom: { x: backdrop.x + backdrop.width * 0.4, y: backdrop.y + backdrop.height + 30 },
  top: { x: backdrop.x + backdrop.width * 0.6, y: backdrop.y - 30 },
  right: { x: backdrop.x + backdrop.width + 90, y: backdrop.y + backdrop.height * 0.3 },
  left: { x: backdrop.x - 220, y: backdrop.y + backdrop.height * 0.7 }
};

for (const [edge, to] of Object.entries(targets)) {
  await dragBarTo(to.x, to.y);
  const tab = page.locator('[data-testid="dock-tab"]');
  await tab.waitFor();
  assert.equal(await tab.getAttribute('data-edge'), edge);
  const box = (await tab.boundingBox())!;
  assert.ok(box.x >= backdrop.x - 1 && box.x + box.width <= backdrop.x + backdrop.width + 1 && box.y >= backdrop.y - 1 && box.y + box.height <= backdrop.y + backdrop.height + 1, `${edge}: tab inside the preview`);
  assert.equal(await page.locator('.float').evaluate((el) => getComputedStyle(el).visibility), 'hidden');
  await page.screenshot({ path: join(SHOTS, `hidden-${edge}.png`) });
  if (edge === 'bottom') {
    await tab.focus();
    await page.keyboard.press('Enter');
  } else {
    await tab.click();
  }
  await page.waitForTimeout(400);
  assert.equal(await page.locator('[data-testid="dock-tab"]').count(), 0);
  assert.equal(await page.locator('.float').evaluate((el) => getComputedStyle(el).visibility), 'visible');
  if (edge === 'bottom') {
    await page.screenshot({ path: join(SHOTS, 'restored.png') });
  }
  console.log(`ok dock ${edge}`);
}

await dragBarTo(backdrop.x + backdrop.width / 2, backdrop.y + backdrop.height / 2);
assert.equal(await page.locator('[data-testid="dock-tab"]').count(), 0, 'a bar inside the preview does not dock');

await panel.pickAt('h1');
await page.waitForTimeout(600);
const field = page.locator('[data-field=font-size] input.value').first();
await field.fill('48px');
await field.press('Enter');
await page.locator('[data-testid="status"]').waitFor({ timeout: 15_000 });
await page.screenshot({ path: join(SHOTS, 'toast-with-close.png') });
const close = page.locator('[data-testid="close"]');
assert.ok((await close.count()) >= 1, 'a close button shows');
for (const el of await close.all()) {
  const b = (await el.boundingBox())!;
  assert.ok(b.width >= 20 && b.height >= 20, 'close hit area at least 20px');
}
await page.locator('[data-testid="status"] [data-testid="close"]').click();
await page.waitForTimeout(300);
assert.equal(await page.locator('[data-testid="status"]').count(), 0, 'the close button dismisses the notice');
console.log('ok close');
await panel.close();
process.exit(0);
