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
await panel.close();
