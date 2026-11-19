import assert from 'node:assert/strict';
import { openPanel } from './harness.mts';

const GAP_PX = 16;
const TOLERANCE_PX = 1;

const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;

async function barAtBottom(label: string) {
  const bar = await page.locator('.float').boundingBox();
  const viewport = page.viewportSize()!;
  const props = await page.locator('aside.right').boundingBox();
  assert.ok(bar, `${label}: the bar is visible`);
  assert.ok(Math.abs(bar.y + bar.height - (viewport.height - GAP_PX)) <= TOLERANCE_PX, `${label}: bottom edge ${bar.y + bar.height} is viewport − ${GAP_PX}`);
  assert.ok(!props || props.width === 0 || bar.x + bar.width <= props.x, `${label}: the bar does not cover the Properties bar`);
  console.log(`ok ${label}`);
}

const edges = async (label: string) => {
  const width = page.viewportSize()!.width;
  const bar = await page.locator('aside.right').boundingBox();
  const right = bar && bar.width > 0 ? bar.x : width;
  const layers = (await page.locator('aside.left').boundingBox())!;
  assert.equal(layers.x, 0, `${label}: the Layers bar starts at the left edge`);
  for (const selector of ['.toolbar', '.backdrop']) {
    const box = (await page.locator(selector).boundingBox())!;
    assert.ok(Math.abs(box.x - (layers.x + layers.width)) <= TOLERANCE_PX, `${label}: ${selector} starts right after the Layers bar`);
    assert.ok(Math.abs(box.x + box.width - right) <= TOLERANCE_PX, `${label}: ${selector} reaches the Properties bar or the right edge`);
  }
  console.log(`ok edges ${label}`);
};

await edges('full');
const heads = await Promise.all(['.left-head', '.toolbar', '.right .tab-list'].map(async (sel) => (await page.locator(sel).first().boundingBox())!));
assert.ok(heads.every((h) => Math.abs(h.height - heads[0].height) <= TOLERANCE_PX && Math.abs(h.y + h.height - (heads[0].y + heads[0].height)) <= TOLERANCE_PX), `the three headers share height and bottom (${heads.map((h) => h.height).join(', ')})`);
console.log('ok one top row');
await barAtBottom('full');
await page.mouse.move(5, 5);
await page.keyboard.press('4');
await page.waitForTimeout(400);
await barAtBottom('phone');
await page.keyboard.press('1');
await page.locator('.overlay').hover();
await page.mouse.wheel(0, 2000);
await page.waitForTimeout(400);
await barAtBottom('scrolled');
const webviewScroll = await page.evaluate(() => document.scrollingElement!.scrollTop);
const pageScroll = await panel.frame.locator('body').evaluate(() => window.scrollY);
assert.equal(webviewScroll, 0, 'the webview itself never scrolls');
assert.ok(pageScroll > 0, `the page scrolls inside the frame (${pageScroll})`);
console.log('ok page scrolls inside the frame');
await page.setViewportSize({ width: 900, height: 600 });
await page.waitForTimeout(400);
await barAtBottom('small window');
await page.setViewportSize({ width: 1440, height: 900 });
await panel.pickAt('#hero');
await page.waitForTimeout(400);
const fits = () => page.locator('aside.right [data-testid=properties]').evaluate((el) => el.scrollWidth <= el.clientWidth);
assert.ok(await fits(), 'no horizontal overflow in the Properties bar at the default width');

const edge = (await page.locator('aside .edge').boundingBox())!;
const before = (await page.locator('.backdrop').boundingBox())!.width;
await page.mouse.move(edge.x + 2, edge.y + 200);
await page.mouse.down();
await page.mouse.move(edge.x + 400, edge.y + 200, { steps: 4 });
await page.mouse.up();
await page.waitForTimeout(400);
const bar = (await page.locator('aside.right').boundingBox())!.width;
assert.ok(Math.abs(bar - 240) <= TOLERANCE_PX, `dragging right clamps the bar to its minimum (${bar})`);
assert.ok(await fits(), 'no horizontal overflow at the minimum width');
assert.ok((await page.locator('.backdrop').boundingBox())!.width > before, 'the preview takes the space');
console.log('ok properties bar resize');

await panel.close();
