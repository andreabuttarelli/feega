import sharp from 'sharp';
import { test, expect, gotoHydrated } from './fixtures/session';

test.skip(!process.env.E2E_REAL_STACK || !process.env.E2E_FAKE_IMAGES, '@real: needs a real stack and the fake image provider (E2E_FAKE_IMAGES=1)');

const GENERATION_TIMEOUT_MS = 90_000;

async function productPhoto(): Promise<Buffer> {
  return sharp({ create: { width: 1200, height: 1200, channels: 3, background: '#2f6f8f' } }).jpeg().toBuffer();
}

test('photo studio: upload, pick two styles, generate, pick one, download for Amazon', async ({ page, session, admin }) => {
  test.setTimeout(180_000);
  try {
    await gotoHydrated(page, `/app/studio?project=${session.projectId}`);

    await page.getByTestId('studio-file').setInputFiles({ name: 'blue-vase.jpg', mimeType: 'image/jpeg', buffer: await productPhoto() });
    await expect(page.getByText('Added to your products.')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Blue vase' })).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId('studio-next-style').click();
    await page.getByTestId('studio-style-marble').click();
    await page.getByTestId('studio-next-generate').click();
    await page.getByRole('radio', { name: '1', exact: true }).click();
    await expect(page.getByTestId('studio-cost')).toContainText('2 photos');

    await page.getByTestId('studio-generate').click();
    await page.waitForURL(/\/app\/studio\/[0-9a-f-]{36}$/);
    await expect(page.getByTestId('studio-ready')).toContainText('2 photos ready', { timeout: GENERATION_TIMEOUT_MS });

    await page.getByRole('button', { name: /^Pick Marble/ }).click();
    await expect(page.getByTestId('studio-actions')).toContainText('1 picked');

    const download = page.waitForEvent('download');
    await page.getByTestId('studio-download-amazon').click();
    expect((await download).suggestedFilename()).toMatch(/-amazon\.zip$/);
  } finally {
    const { data } = await admin.storage.from('brand-knowledge').list(`${session.userId}/media`);
    if (data?.length) {
      await admin.storage.from('brand-knowledge').remove(data.map((f) => `${session.userId}/media/${f.name}`));
    }
  }
});
