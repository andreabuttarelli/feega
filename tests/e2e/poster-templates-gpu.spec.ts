import { join } from 'node:path';
import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { openInsert } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.E2E_SHOTS_DIR;
const PREVIEWS = join(import.meta.dirname, '../../static/component-previews');
const SAMPLE = { width: 24, height: 30 };
const MAX_DRIFT = 9;
const DRAWN_TIMEOUT_MS = 30_000;
const SETTLE_MS = 2500;

async function sampled(input: Buffer | string): Promise<Buffer> {
  return sharp(input).resize(SAMPLE.width, SAMPLE.height, { fit: 'fill' }).removeAlpha().blur(0.6).raw().toBuffer();
}

async function drift(shot: Buffer, preview: string): Promise<number> {
  const [a, b] = await Promise.all([sampled(shot), sampled(preview)]);
  return a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;
}

async function openTemplates(page: Page) {
  await (await openInsert(page)).locator('[data-insert="frame-templates"]').click();
  const picker = page.getByRole('dialog', { name: 'Frame templates' });
  await picker.getByRole('radio', { name: 'Still', exact: true }).click();
  return picker;
}

test.use({ viewport: { width: 1440, height: 900 }, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test.describe('every poster template draws whole on the GPU canvas @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('each poster matches its gallery preview, with nothing left out', async ({ page, session, browserName }) => {
    test.setTimeout(30 * 60_000);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const listed = await openTemplates(page);
    const ids = (await listed.locator('[data-component]').evaluateAll((els) => els.map((e) => e.getAttribute('data-component') ?? ''))).filter((id) => id.startsWith('builtin:poster-'));
    await page.keyboard.press('Escape');
    expect(ids.length, 'the gallery lists the poster templates').toBeGreaterThan(0);

    for (const id of ids) {
      const name = id.replace('builtin:', '');
      await (await openTemplates(page)).locator(`[data-component="${id}"]`).first().click();
      const frame = page.locator('[data-testid=motion-node]').first();
      await expect(frame).toBeVisible({ timeout: DRAWN_TIMEOUT_MS });
      await expect.poll(() => page.getByTestId('core-canvas').getAttribute('data-frames'), { timeout: DRAWN_TIMEOUT_MS, message: `${name} is drawn by the GPU canvas` }).toBe('1');
      await page.keyboard.press('Shift+1');
      await page.waitForTimeout(SETTLE_MS);

      expect.soft(await page.getByTestId('core-canvas').getAttribute('data-partial'), `${name} leaves nothing out`).toBe('0');
      const shot = await page.screenshot({ clip: (await frame.boundingBox())!, ...(SHOTS ? { path: `${SHOTS}/${browserName}-${name}.png` } : {}) });
      expect.soft(await drift(shot, join(PREVIEWS, `builtin-${name}.jpg`)), `${name} looks like its preview, not black or empty`).toBeLessThan(MAX_DRIFT);

      await frame.click({ force: true });
      await page.keyboard.press('Delete');
      await expect(page.locator('[data-testid=motion-node]')).toHaveCount(0);
    }
  });
});
