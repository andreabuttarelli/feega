import { test, expect } from '@playwright/test';

const HOST_PAGE = '/changelog';
const PROBE = '/tests/e2e/fixtures/fps-probe.ts';
const FRAMES = 40;
const MOVING_FROM = 16;
const RENDER_TIMEOUT_MS = 180_000;

test('a 60 fps template exports in the browser with every frame its own', async ({ page }) => {
  test.setTimeout(RENDER_TIMEOUT_MS);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(HOST_PAGE);
  await page.evaluate((path) => import(path), PROBE);

  const run = await page.evaluate((frames) => window.fpsProbe.render(frames), FRAMES);

  expect(run.error).toBeNull();
  const repeated = run.diffs.slice(MOVING_FROM).filter((d) => d === 0).length;
  expect(repeated, `frame diffs: ${run.diffs.join(',')}`).toBe(0);
});
