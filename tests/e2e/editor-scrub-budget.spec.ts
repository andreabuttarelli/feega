import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { instrument } from './fixtures/frame-sweeps';
import type { SeekPath } from './fixtures/editor-scrub-probe';

const HOST_PAGE = '/changelog';
const PROBE = '/tests/e2e/fixtures/editor-scrub-probe.ts';
const SWEEP_MS = 5000;
const THROTTLE = Number(process.env.CANVAS_PERF_THROTTLE ?? 1);
const MIN_INNER_FPS = 55;

const summary = (list: number[]) => {
  const sorted = [...list].sort((a, b) => a - b);
  const at = (share: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))] ?? 0;
  const mean = list.reduce((a, b) => a + b, 0) / Math.max(1, list.length);
  const round = (n: number) => Math.round(n * 10) / 10;
  return { fpsAvg: Math.round(1000 / mean), fpsP5: Math.round(1000 / at(0.95)), p50: round(at(0.5)), p95: round(at(0.95)), max: round(sorted.at(-1) ?? 0), frames: list.length };
};

async function sweep(page: Page, run: () => Promise<unknown>) {
  await page.evaluate(() => {
    Object.assign((window as unknown as { __frames: object }).__frames, { gaps: [], work: [], counting: true });
    window.editorScrub.startInner();
  });
  await run();
  const { host, inner } = await page.evaluate(async () => {
    const probe = (window as unknown as { __frames: { gaps: number[]; work: number[]; counting: boolean } }).__frames;
    probe.counting = false;
    return { host: { gaps: probe.gaps, work: probe.work }, inner: await window.editorScrub.stopInner() };
  });
  return { host: summary(host.gaps), hostWorkP95: summary(host.work).p95, inner: summary(inner.gaps), innerWorkP95: summary(inner.work).p95 };
}

test.describe('editor scrub and playback frame budget @perf', () => {
  test.skip(!process.env.E2E_PERF, 'misura frame su questa macchina: E2E_PERF=1');
  test.setTimeout(180_000);

  test('scrub through each seek path, then play', async ({ page, browserName }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(instrument);
    if (THROTTLE > 1 && browserName === 'chromium') {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
    }
    await page.goto(HOST_PAGE);
    await page.evaluate((path) => import(path), PROBE);
    await page.evaluate(() => window.editorScrub.mount());

    for (const path of ['both', 'player', 'exact'] as SeekPath[]) {
      const result = await sweep(page, () => page.evaluate(({ p, ms }) => window.editorScrub.scrub(p, ms), { p: path, ms: SWEEP_MS }));
      console.log(`[editor-scrub] ${test.info().project.name} scrub-${path} ${JSON.stringify(result)}`);
    }
    const played = await sweep(page, () => page.evaluate((ms) => window.editorScrub.play(ms), SWEEP_MS));
    console.log(`[editor-scrub] ${test.info().project.name} play ${JSON.stringify(played)}`);

    await page.evaluate(() => window.editorScrub.listen());
    await page.mouse.click(480, 270);
    await expect.poll(() => page.evaluate(() => window.editorScrub.taps().length)).toBe(1);

    const touched = await sweep(page, () => page.evaluate((ms) => window.editorScrub.play(ms), SWEEP_MS));
    console.log(`[editor-scrub] ${test.info().project.name} play-after-tap ${JSON.stringify(touched)}`);
    expect(touched.inner.fpsAvg).toBeGreaterThanOrEqual(MIN_INNER_FPS);

    const scrubbed = await sweep(page, () => page.evaluate(({ p, ms }) => window.editorScrub.scrub(p, ms), { p: 'both' as SeekPath, ms: SWEEP_MS }));
    console.log(`[editor-scrub] ${test.info().project.name} scrub-after-tap ${JSON.stringify(scrubbed)}`);
    expect(scrubbed.inner.fpsAvg).toBeGreaterThanOrEqual(MIN_INNER_FPS);
  });
});
