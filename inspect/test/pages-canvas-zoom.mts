import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { openPanel } from './harness.mts';

const SHOT = process.env.SHOT!;
const EXTRA_PAGES = 12;
const SETTLE_WAIT_MS = 4000;
const GESTURE_GAP_MS = 80;
const PAN_PX = 900;
const ZOOM_STEPS = [...Array(6).fill('out'), ...Array(6).fill('in'), ...Array(4).fill('out'), ...Array(4).fill('in'), ...Array(3).fill('out')] as const;
mkdirSync(dirname(SHOT), { recursive: true });

function manyPages(source: string): string {
  const root = mkdtempSync(join(tmpdir(), 'canvas-zoom-'));
  cpSync(source, root, { recursive: true, filter: (path) => !path.includes('node_modules') });
  symlinkSync(join(source, 'node_modules'), join(root, 'node_modules'));
  for (let i = 1; i <= EXTRA_PAGES; i++) {
    mkdirSync(join(root, 'src/routes', `zoom${i}`), { recursive: true });
    writeFileSync(join(root, 'src/routes', `zoom${i}`, '+page.svelte'), `<h1>Zoom page ${i}</h1>\n<p>Fixture page for the canvas zoom test.</p>\n`);
  }

  return root;
}

const panel = await openPanel(manyPages(process.env.INSPECT_APP_ROOT!));
const { page } = panel;

const counts: Record<string, number> = {};
page.on('framenavigated', async (frame) => {
  if (frame === page.mainFrame() || frame.url() === 'about:blank') {
    return;
  }
  const key = await (await frame.frameElement()).evaluate((el) => el.closest('[data-key]')?.getAttribute('data-key') ?? null).catch(() => null);
  if (key) {
    counts[key] = (counts[key] ?? 0) + 1;
  }
});
await page.locator('[data-testid="pages-tab"]').click();
await page.locator('[data-testid="canvas-open-pages"]').click();
await page.locator('[data-testid="pages-canvas"]').waitFor();
const loads = async () => ({ ...counts });

await page.locator('[data-testid="pages-canvas"]').hover();
await page.keyboard.press('Shift+Digit0');
await page.waitForTimeout(SETTLE_WAIT_MS);
const loaded = await loads();
assert.ok(Object.keys(loaded).length > 0, 'frames load once the canvas is readable');
await page.screenshot({ path: SHOT.replace(/\.png$/, '-before-zoom.png') });

const click = (name: 'in' | 'out') => page.locator(`[data-testid="canvas-zoom"] button[aria-label="Zoom ${name}"]`).click();

const blank = () =>
  page.locator('[data-testid="canvas-frame"]').evaluateAll((frames) =>
    frames
      .filter((f) => !f.querySelector('.shot') && !f.querySelector('.card') && !f.querySelector('iframe[data-ready="true"]'))
      .map((f) => f.getAttribute('data-key'))
  );
const whiteIframes = () => page.locator('[data-testid="canvas-frame"] iframe:not([data-ready="true"])').evaluateAll((els) => els.filter((e) => Number(getComputedStyle(e).opacity) > 0 && getComputedStyle(e).visibility !== 'hidden').length);

for (const [i, step] of ZOOM_STEPS.entries()) {
  await click(step);
  await page.mouse.wheel(0, i % 4 < 2 ? PAN_PX : -PAN_PX);
  await page.waitForTimeout(GESTURE_GAP_MS);
  assert.deepEqual(await blank(), [], 'no frame is ever blank');
  assert.equal(await whiteIframes(), 0, 'no loading iframe is visible');
}
await page.waitForTimeout(SETTLE_WAIT_MS);

const after = await loads();
const reloaded = Object.entries(loaded).filter(([key, count]) => (after[key] ?? 0) > count);
const total = Object.values(after).reduce((sum, n) => sum + n, 0);
console.log(`LOADS before=${Object.values(loaded).reduce((s, n) => s + n, 0)} total=${total} reloaded=${reloaded.length} iframes=${await page.locator('[data-testid="canvas-frame"] iframe').count()}`);
assert.deepEqual(reloaded, [], 'frames already loaded never reload while zooming');

await page.screenshot({ path: SHOT });
await panel.close();
