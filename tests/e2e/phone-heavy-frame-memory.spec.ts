import { execSync } from 'node:child_process';
import { test, expect, devices, webkit, type Page } from '@playwright/test';
import heavy from './fixtures/heavy-canvas-landings.json' with { type: 'json' };

const MB_PER_KB = 1 / 1024;
const GPU_LIMIT_MB = 800;
const SAMPLE_MS = 200;
const OPEN_WINDOW_MS = 10_000;
const ZOOM_STEPS = 12;
const MIN_TAP_PX = 140;
const SETTLE_MS = 15_000;
const HEAVIEST_LANDING = heavy.landings[0].desktop.nodeId;

const webkitPids = (): Set<string> =>
  new Set(
    execSync('ps -axo pid=,comm=')
      .toString()
      .split('\n')
      .filter((l) => /WebKit\.GPU/.test(l))
      .map((l) => l.trim().split(/\s+/)[0])
  );

function gpuMb(mine: Set<string>): number {
  let peak = 0;
  for (const line of execSync('ps -axo pid=,rss=').toString().split('\n')) {
    const [pid, kb] = line.trim().split(/\s+/);
    if (mine.has(pid)) {
      peak = Math.max(peak, Math.round(Number(kb) * MB_PER_KB));
    }
  }
  return peak;
}

async function login(page: Page, base: string) {
  await page.goto(`${base}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function zoomOnto(page: Page, nodeId: string) {
  const node = page.locator(`.svelte-flow__node[data-id="${nodeId}"]`);
  let box = (await node.boundingBox())!;
  for (let i = 0; i < ZOOM_STEPS && box.width < MIN_TAP_PX; i++) {
    await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.dispatchEvent(new WheelEvent('wheel', { clientX: x, clientY: y, deltaY: -60, ctrlKey: true, bubbles: true, cancelable: true })), [box.x + box.width / 2, box.y + box.height / 2]);
    await page.waitForTimeout(250);
    box = (await node.boundingBox())!;
  }
  return { x: Math.max(20, box.x + box.width / 2), y: Math.max(20, box.y + Math.min(box.height / 2, 300)) };
}

test.describe('a heavy frame opens on an iPhone without blowing the GPU process @real', () => {
  test.skip(!process.env.E2E_HEAVY_PHONE || !process.env.E2E_TEST_EMAIL, 'needs E2E_HEAVY_PHONE=1 and the test account on the heavy canvas copy');
  test.setTimeout(120_000);

  test('opening the 274-clip landing keeps the WebKit GPU process under the limit', async ({ baseURL }) => {
    const before = webkitPids();
    const browser = await webkit.launch();
    const page = await (await browser.newContext({ ...devices['iPhone 15 Pro'], serviceWorkers: 'block' })).newPage();
    await login(page, baseURL!);
    const mine = new Set([...webkitPids()].filter((p) => !before.has(p)));
    expect(mine.size, 'this test sees its own WebKit GPU process').toBeGreaterThan(0);

    await page.goto(`${baseURL}/p/${heavy.projectId}/c/${heavy.canvasId}`);
    await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);

    const at = await zoomOnto(page, HEAVIEST_LANDING);
    await page.touchscreen.tap(at.x, at.y);
    await page.waitForTimeout(800);
    await page.mouse.dblclick(at.x, at.y);

    let peak = 0;
    const start = Date.now();
    while (Date.now() - start < OPEN_WINDOW_MS) {
      peak = Math.max(peak, gpuMb(mine));
      await page.waitForTimeout(SAMPLE_MS);
    }
    const opened = await page.getByTestId('motion-editor').count();
    await browser.close();
    console.log(`GPU process peak while opening: ${peak} MB`);
    expect(opened, 'the editor opened').toBe(1);
    expect(peak, `GPU process peak ${peak} MB`).toBeLessThan(GPU_LIMIT_MB);
  });
});
