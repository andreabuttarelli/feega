import assert from 'node:assert/strict';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { openPanel } from './harness.mts';

const SHOTS = join(homedir(), 'Documents/feega-videos/shots/inspect');
const TOLERANCE_PX = 1;
const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;
const base = `http://127.0.0.1:${process.env.PANEL_PORT ?? 5999}`;

async function checkRows(label: string) {
  const bar = (await page.locator('aside.right').boundingBox())!;
  for (const row of await page.locator('aside.right .row').all()) {
    const l = await row.locator('.label').boundingBox();
    const c = await row.locator('.control').boundingBox();
    if (l && c) {
      assert.ok(Math.abs(l.y + l.height / 2 - (c.y + c.height / 2)) <= TOLERANCE_PX, `${label}: label and control share a centre line`);
    }
  }
  for (const section of await page.locator('aside.right section').all()) {
    const box = (await section.boundingBox())!;
    assert.ok(Math.abs(box.width - bar.width) <= 2, `${label}: section dividers span the bar (${box.width} vs ${bar.width})`);
  }
  console.log(`ok rows ${label}`);
}

for (const [theme, url] of [['dark', `${base}/`], ['light', `${base}/light`]]) {
  if (theme === 'light') {
    await page.goto(url);
    await page.locator('.overlay').waitFor({ timeout: 120_000 });
  }
  for (const [name, selector] of [['text', process.env.INSPECT_TEXT ?? '.lead'], ['box', process.env.INSPECT_BOX ?? '#hero']]) {
    await panel.pickAt(selector);
    await page.waitForTimeout(500);
    await checkRows(`${theme} ${name}`);
    const bar = (await page.locator('aside.right').boundingBox())!;
    await page.screenshot({ path: join(SHOTS, `20-bar-${name}-${theme}.png`), clip: { x: bar.x, y: 0, width: bar.width, height: Math.min(1800, bar.height) } });
  }
}
await panel.close();
process.exit(0);
