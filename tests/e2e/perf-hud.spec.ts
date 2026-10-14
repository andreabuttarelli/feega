import { test, expect } from '@playwright/test';

const PAGE = '/changelog';

test('?perf=1 shows the real frame rate, long tasks and DOM size, and remembers it', async ({ page }) => {
  await page.goto(`${PAGE}?perf=1`);

  const hud = page.getByTestId('perf-hud');
  await expect(hud).toBeVisible();
  await expect.poll(async () => Number(await page.getByTestId('perf-hud-rate').textContent())).toBeGreaterThan(0);
  await expect.poll(async () => Number(await page.getByTestId('perf-hud-dom').textContent())).toBeGreaterThan(0);

  await page.goto(PAGE);
  await expect(hud).toBeVisible();

  await page.goto(`${PAGE}?perf=0`);
  await expect(page.locator('body')).toBeVisible();
  await expect(hud).toHaveCount(0);
});

test('without the flag the HUD costs nothing: it is not on the page', async ({ page }) => {
  await page.goto(PAGE);
  await expect(page.locator('body')).toBeVisible();
  await expect(page.getByTestId('perf-hud')).toHaveCount(0);
});
