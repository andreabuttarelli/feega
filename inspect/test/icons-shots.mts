import { homedir } from 'node:os';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const SHOTS = join(homedir(), 'Documents/feega-videos/screens');
const TILES = '.icon-popover .icon-tile';
const SETTLE_POLLS = 40;
const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;

async function settled() {
  await page.waitForTimeout(1500);
  for (let i = 0; i < SETTLE_POLLS && (await page.locator('.icon-skeleton').count()) > 0; i++) {
    await page.waitForTimeout(500);
  }
}

async function report(label: string) {
  const tiles = await page.locator(TILES).count();
  const glyphs = await page.locator(`${TILES} .icon-glyph`).count();
  const names = await page.locator(`${TILES} .icon-fallback`).count();
  const skeletons = await page.locator('.icon-skeleton').count();
  console.log(label, { tiles, glyphs, names, skeletons });
}

await panel.pickAt(process.env.INSPECT_ICON ?? 'svg');
await page.waitForTimeout(800);
await page.locator('[data-field=icon-replace]').click();
await page.locator(TILES).first().waitFor();
await settled();
await report('library tab');
await page.screenshot({ path: join(SHOTS, 'icons-menu-open.png'), clip: { x: 560, y: 0, width: 880, height: 760 } });

const grid = page.locator('.icon-popover .icon-results');
await grid.evaluate((el) => (el.scrollTop = el.scrollHeight));
await settled();
await report('library tab scrolled');

await page.locator('.icon-query').fill('arrow');
await settled();
const tabs = page.locator('.icon-tab');
if ((await tabs.count()) > 1) {
  await tabs.nth(1).click();
}
await settled();
await report('iconmcp arrow top');
await page.screenshot({ path: join(SHOTS, 'icons-menu-search.png'), clip: { x: 560, y: 0, width: 880, height: 760 } });

for (let step = 0; step < 8; step++) {
  await grid.evaluate((el) => (el.scrollTop += 200));
  await settled();
}
await report('iconmcp arrow scrolled');
await panel.close();
process.exit(0);
