import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openPanel } from './harness.mts';

const SHOT = process.env.SHOT!;
const ALL_CAPTURED_TIMEOUT_MS = 560000;
mkdirSync(dirname(SHOT), { recursive: true });

const panel = await openPanel(process.env.INSPECT_APP_ROOT!);
const { page } = panel;
page.on('console', (m) => (m.text().includes('[feega]') ? console.log('console', m.text().slice(0, 300)) : undefined));

await page.locator('[data-testid="pages-tab"]').click();
await page.locator('[data-testid="canvas-open-pages"]').click();
await page.locator('[data-testid="pages-canvas"]').waitFor();

const started = Date.now();
const total = await page.locator('[data-testid="canvas-frame"]').count();
const withTarget = () => page.locator('[data-testid="canvas-frame"][data-snap="true"]').count();
const settled = () => page.locator('[data-testid="canvas-frame"] .card').count();

await page.waitForFunction(
  () => {
    const frames = [...document.querySelectorAll('[data-testid="canvas-frame"]')];
    return frames.length > 0 && frames.every((f) => f.getAttribute('data-snap') === 'true' || f.querySelector('.manual'));
  },
  undefined,
  { timeout: ALL_CAPTURED_TIMEOUT_MS, polling: 500 }
).catch(() => undefined);

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(`FRAMES total=${total} captured=${await withTarget()} cards=${await settled()} seconds=${seconds}`);
assert.equal(await page.locator('[data-testid="canvas-frame"] iframe').count(), 0, 'no live iframes in the canvas');

await page.locator('[data-testid="canvas-fit"]').click();
await page.waitForTimeout(500);
await page.screenshot({ path: SHOT });

const ZOOM_STEPS = 9;
const SCROLL_TOP_PX = -200000;
await page.locator('[data-testid="pages-canvas"]').hover();
for (let i = 0; i < ZOOM_STEPS; i++) {
  await page.locator('[data-testid="canvas-zoom"] button[aria-label="Zoom in"]').click();
}
await page.mouse.wheel(0, SCROLL_TOP_PX);
await page.waitForTimeout(500);
await page.screenshot({ path: SHOT.replace(/\.png$/, '-zoomed.png') });

await panel.close();
