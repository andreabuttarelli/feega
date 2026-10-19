import { test, expect, devices, webkit } from '@playwright/test';
import { login, openFrame } from './fixtures/heavy-canvas';
import heavy from './fixtures/heavy-canvas-landings.json' with { type: 'json' };

const MOTION_FRAME = '61c7743a-add3-4f9a-96db-7c6eb3ed54bf';
const MIN_FPS_P50 = 45;
const PLAY_MS = 4_000;
const SETTLE_MS = 12_000;

test.describe('a motion frame plays smoothly on an iPad @real', () => {
  test.skip(!process.env.E2E_HEAVY_PHONE || !process.env.E2E_TEST_EMAIL, 'needs E2E_HEAVY_PHONE=1 and the test account on the heavy canvas copy');
  test.setTimeout(120_000);

  test('playback keeps its layers and runs at 45 fps or more inside the preview', async ({ baseURL }) => {
    const browser = await webkit.launch();
    const page = await (await browser.newContext({ ...devices['iPad Pro 11'], serviceWorkers: 'block' })).newPage();
    await login(page, baseURL!);
    await page.goto(`${baseURL}/p/${heavy.projectId}/c/${heavy.canvasId}`);
    await page.getByRole('button', { name: 'Reject all' }).click({ timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
    await openFrame(page, MOTION_FRAME);
    await page.waitForTimeout(3_000);

    const preview = page.frames().find((f) => f.url().startsWith('about:srcdoc'))!;
    const layers = await preview.evaluate(() => [...document.querySelectorAll('*')].filter((el) => getComputedStyle(el).willChange !== 'auto').length);
    await preview.evaluate(() => {
      const w = window as unknown as { gaps: number[] };
      w.gaps = [];
      let last = 0;
      const tick = (t: number) => {
        if (last) {
          w.gaps.push(t - last);
        }
        last = t;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.getByTestId('motion-editor').getByRole('button', { name: 'Play', exact: true }).click();
    await page.waitForTimeout(PLAY_MS);
    const gaps = await preview.evaluate(() => (window as unknown as { gaps: number[] }).gaps.sort((a, b) => a - b));
    await browser.close();

    const p50 = Math.round(1000 / gaps[Math.floor(gaps.length / 2)]);
    console.log(`iPad playback: ${p50} fps p50, ${layers} hinted layers`);
    expect(layers, 'the preview keeps its will-change layers while it plays').toBeGreaterThan(0);
    expect(p50).toBeGreaterThanOrEqual(MIN_FPS_P50);
  });
});
