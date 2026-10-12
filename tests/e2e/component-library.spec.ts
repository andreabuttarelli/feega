import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.E2E_SHOTS_DIR;
const PROMPT = 'builtin:prompt-input';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];

test.describe('component library @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}: dashboard → use in new video → the editor shows the component`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize(viewport);
      await gotoHydrated(page, '/app');

      const shelf = page.getByTestId('home-components');
      await shelf.scrollIntoViewIfNeeded();
      await shelf.locator('[data-format="9:16"]').click();
      const card = shelf.locator(`[data-component="${PROMPT}"]`);
      await card.scrollIntoViewIfNeeded();
      if (SHOTS) {
        await page.waitForTimeout(1500);
        await shelf.screenshot({ path: `${SHOTS}/${viewport.name}-1-dashboard.png` });
      }

      await card.getByTestId('use-component').click();
      await page.waitForURL(/\/motion\/[^/?]+$/);
      await expect(page.getByTestId('template-inspector').or(page.getByRole('button', { name: 'Add', exact: true }))).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText('Prompt input').first()).toBeVisible();
      if (viewport.name === 'desktop') {
        await expect(page.getByText(/^Prompt input · /)).toBeVisible();
      }
      if (SHOTS) {
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `${SHOTS}/${viewport.name}-2-editor.png` });
      }

      if (viewport.name !== 'desktop') {
        return;
      }
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await page.getByTestId('open-components').click();
      const library = page.getByTestId('component-library');
      await expect(library.getByTestId('component-grid')).toBeVisible();
      if (SHOTS) {
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SHOTS}/${viewport.name}-3-library.png` });
      }
      await library.locator(`[data-component="${PROMPT}"]`).click();
      await expect(library.getByTestId('component-detail')).toContainText('Prompt input');
      if (SHOTS) {
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SHOTS}/${viewport.name}-4-detail.png` });
      }
    });
  }

  test('mobile: the editor component library is a full-screen sheet', async ({ page, session, seedNode }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const node = await seedNode({ type: 'motion', data: { format: 'landscape', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null } });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);

    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByTestId('open-components').click();
    const library = page.getByTestId('component-library');
    await library.getByTestId('component-search').fill('prompt');
    await library.locator(`[data-component="${PROMPT}"]`).click();
    if (SHOTS) {
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SHOTS}/mobile-3-library-detail.png` });
    }
    await library.getByTestId('insert-component').click();
    await expect(page.getByTestId('component-library')).toHaveCount(0);
  });
});
