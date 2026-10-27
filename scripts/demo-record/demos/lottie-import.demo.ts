import { join } from 'node:path';
import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { openCanvas } from './seed';

const LOTTIE = join(process.cwd(), 'scripts', 'demo-record', 'fixtures', 'payment-success.json');

test('import a Lottie animation onto the canvas', async ({ page, session }) => {
  await installCursor(page);
  await openCanvas(page, session);

  await recordDemo(page, { slug: 'lottie-import', title: 'import a Lottie animation' }, async (d) => {
    await d.wait(1500);
    await page.locator('input[type=file][accept*=".lottie"]').setInputFiles(LOTTIE);
    await expect(page.locator('[data-testid="frame-overlays"] [data-frame]')).toHaveCount(1, { timeout: 30_000 });
    await d.wait(3000);
    await page.screenshot({ path: '/tmp/claude-501/x/lottie.png' });
    await d.click(page.getByTestId('frame-timeline-play'));
    await d.wait(3500);
  });
});
