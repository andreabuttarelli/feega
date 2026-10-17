import { test, expect } from '@playwright/test';

const HOST_PAGE = '/changelog';
const COVER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40"><rect width="30" height="40" fill="%23c96"/></svg>';

const MODELS = [
  { id: 'ava', name: 'Ava', cover: COVER, allowed: true, why: '' },
  { id: 'real', name: 'Real Talent', cover: COVER, allowed: false, why: 'Catalogue talents are real people: the studio casts only synthetic models.' },
  { id: 'noa', name: 'Noa', cover: null, allowed: true, why: '' }
];

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`studio influencer step at ${viewport.width}px: covers, disabled reason, multi-select`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto(HOST_PAGE);
    await page.evaluate((path) => import(path), '/tests/e2e/fixtures/influencer-picker-harness.svelte.ts');
    await page.evaluate((models) => window.influencerPicker.mount(models), MODELS);

    await expect(page.getByTestId('studio-influencer-ava').locator('img')).toBeVisible();
    await expect(page.getByTestId('studio-influencer-real')).toBeDisabled();
    await expect(page.getByTestId('studio-influencer-real')).toContainText('real people');

    await page.getByTestId('studio-influencer-ava').click();
    await page.getByTestId('studio-influencer-noa').click();
    await expect(page.getByTestId('studio-influencer-ava')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.influencerPicker.picked)).toEqual(['ava', 'noa']);

    await expect(page.getByRole('link', { name: 'Create an influencer' })).toHaveAttribute('href', '/p/p1/influencers');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
}
