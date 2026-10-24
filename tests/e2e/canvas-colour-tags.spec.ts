import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2000;

test.describe('colour tags @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('tag two nodes, filter by the colour, tag survives a reload', async ({ page, session, admin, seedNode }) => {
    const first = await seedNode({ type: 'text', x: 0, y: 0, data: { prompt: 'alpha copy' } });
    const second = await seedNode({ type: 'text', x: 700, y: 0, data: { prompt: 'beta copy' } });
    await seedNode({ type: 'text', x: 1400, y: 0, data: { prompt: 'gamma copy' } });
    const canvas = `/p/${session.projectId}/c/${session.canvasId}`;

    await gotoHydrated(page, canvas);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);

    const box = async (id: string) => (await page.locator(`[data-testid="gpu-node"][data-id="${id}"]`).boundingBox())!;
    const a = await box(first.id);
    await page.mouse.click(a.x + a.width / 2, a.y + a.height - 20);
    const b = await box(second.id);
    await page.keyboard.down('Shift');
    await page.mouse.click(b.x + b.width / 2, b.y + b.height - 20);
    await page.keyboard.up('Shift');
    await expect(page.getByText('2 selected')).toBeVisible();

    await page.getByTestId('colour-tag-menu').click();
    await page.getByTestId('colour-tag-red').click();
    await page.screenshot({ path: `${SHOTS_DIR}/f4-colour-tagged.png` });

    await expect
      .poll(async () => (await admin.from('nodes').select('data').in('id', [first.id, second.id])).data?.map((r) => (r.data as { colorTag?: string }).colorTag))
      .toEqual(['red', 'red']);

    await gotoHydrated(page, canvas);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    await page.keyboard.press('Control+f');
    await page.getByTestId('search-colour-red').click();
    await expect(page.getByTestId('node-search').getByRole('option')).toHaveCount(2);
    await page.screenshot({ path: `${SHOTS_DIR}/f4-colour-filter.png` });
    await page.getByTestId('search-colour-blue').click();
    await expect(page.getByTestId('node-search').getByRole('option')).toHaveCount(0);
  });
});
