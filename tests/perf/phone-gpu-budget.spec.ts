import { test, expect, chromium, devices, type Page } from '@playwright/test';

const BASE = process.env.PROBE_BASE ?? 'http://127.0.0.1:5188';
const PHONE_GPU_BYTES = 192 * 1024 * 1024;
const MB = 1024 * 1024;
const SAMPLE_MS = 250;
const SETTLE_MS = 15_000;
const CPU_SLOWDOWN = 4;
const ZOOM_STEPS = [...Array(15).fill(-60), ...Array(15).fill(60)];

function countTextures() {
  const live = new Map<object, number>();
  (window as unknown as { __gpuBytes: () => number }).__gpuBytes = () => [...live.values()].reduce((a, b) => a + b, 0);
  const gpu = window as unknown as { GPUDevice?: { prototype: { createTexture: (d: { size: number[] | { width: number; height?: number }; format: string }) => object } }; GPUTexture?: { prototype: { destroy: () => void } } };
  if (!gpu.GPUDevice || !gpu.GPUTexture) {
    return;
  }
  const create = gpu.GPUDevice.prototype.createTexture;
  gpu.GPUDevice.prototype.createTexture = function (d) {
    const t = create.call(this, d);
    const s = Array.isArray(d.size) ? { w: d.size[0], h: d.size[1] ?? 1 } : { w: d.size.width, h: d.size.height ?? 1 };
    live.set(t, s.w * s.h * (/32float/.test(d.format) ? 16 : /16float/.test(d.format) ? 8 : 4));
    return t;
  };
  const destroy = gpu.GPUTexture.prototype.destroy;
  gpu.GPUTexture.prototype.destroy = function () {
    live.delete(this);
    return destroy.call(this);
  };
}

const liveBytes = (page: Page) => page.evaluate(() => (window as unknown as { __gpuBytes: () => number }).__gpuBytes());

async function sampled(page: Page, peaks: number[], run: () => Promise<void>) {
  let going = true;
  const sampling = (async () => {
    while (going) {
      peaks.push(await liveBytes(page));
      await page.waitForTimeout(SAMPLE_MS);
    }
  })();
  await run();
  going = false;
  await sampling;
}

test('a phone keeps live GPU textures inside its budget through load and zoom on the user canvas copy', async () => {
  test.setTimeout(600_000);
  const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu'] });
  const context = await browser.newContext(devices['iPhone 14']);
  const page = await context.newPage();
  await page.addInitScript({ content: 'window.__name = (f) => f;' });
  await page.addInitScript(countTextures);
  await page.goto(`${BASE}/login`);
  await page.fill('input[type=email]', process.env.E2E_TEST_EMAIL!);
  await page.fill('input[type=password]', process.env.E2E_TEST_PASSWORD!);
  await page.press('input[type=password]', 'Enter');
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { waitUntil: 'commit' });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_SLOWDOWN });

  const peaks: number[] = [];
  await page.goto(`${BASE}/p/${process.env.PROBE_PROJECT}/c/${process.env.PROBE_CANVAS}`);
  await page.waitForSelector('[data-testid=core-canvas]', { timeout: 120_000 });
  await sampled(page, peaks, () => page.waitForTimeout(SETTLE_MS));
  const box = page.viewportSize()!;
  await page.mouse.move(box.width / 2, box.height / 2);
  await sampled(page, peaks, async () => {
    for (const dy of ZOOM_STEPS) {
      await page.keyboard.down('Control');
      await page.mouse.wheel(0, dy);
      await page.keyboard.up('Control');
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(8000);
  });
  await browser.close();

  const peak = Math.max(...peaks);
  console.log(`phone live GPU peak=${(peak / MB).toFixed(1)}MB samples=${peaks.length}`);
  expect(peak).toBeLessThanOrEqual(PHONE_GPU_BYTES);
});
