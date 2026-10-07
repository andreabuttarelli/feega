import { chromium, devices, webkit, type BrowserType } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import doc from './fixtures/motion-doc.json' with { type: 'json' };
import { RENDER_BUCKET, mintRenderLink, renderedAsset, seedMotion } from './fixtures/render-link';

const SHORT = { ...doc, durationInFrames: 20 };
const RENDER_TIMEOUT_MS = 120_000;
const SHOTS = process.env.RENDER_SHOTS;

type Device = { name: string; engine: BrowserType; options: (typeof devices)[string] };

const DEVICES: Device[] = [
  { name: 'desktop', engine: chromium, options: devices['Desktop Chrome'] },
  { name: 'pixel', engine: chromium, options: devices['Pixel 7'] },
  { name: 'iphone', engine: webkit, options: devices['iPhone 13'] }
];

test.describe('render link @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.setTimeout(RENDER_TIMEOUT_MS * 2);

  for (const device of DEVICES) {
    test(`${device.name}: il link renderizza nel browser, salva l'asset e chiude il run`, async ({ session, admin, seedNode, baseURL }) => {
      const nodeId = await seedMotion(admin, session, seedNode, SHORT);
      const { runId, url } = await mintRenderLink(admin, session, nodeId);

      const browser = await device.engine.launch();
      try {
        const context = await browser.newContext({ ...device.options, baseURL });
        const page = await context.newPage();
        await gotoHydrated(page, url);
        await expect(page.getByTestId('render-page')).toBeVisible();

        const blocked = page.getByTestId('render-blocked');
        const start = page.getByTestId('render-start');
        await expect(blocked.or(start)).toBeVisible({ timeout: 20_000 });
        if (SHOTS) {
          await page.screenshot({ path: `${SHOTS}/render-${device.name}-ready.png`, fullPage: true });
        }
        if (await blocked.isVisible()) {
          test.info().annotations.push({ type: 'blocked', description: (await blocked.textContent()) ?? '' });
          return;
        }

        const t0 = Date.now();
        await start.click();
        await expect(page.getByTestId('render-progress')).toBeVisible();
        if (SHOTS) {
          await page.screenshot({ path: `${SHOTS}/render-${device.name}-progress.png`, fullPage: true });
        }
        await expect(page.getByTestId('render-saved')).toBeVisible({ timeout: RENDER_TIMEOUT_MS });
        test.info().annotations.push({ type: 'render-ms', description: String(Date.now() - t0) });
        if (SHOTS) {
          await page.screenshot({ path: `${SHOTS}/render-${device.name}-done.png`, fullPage: true });
        }

        const asset = await renderedAsset(admin, runId);
        expect(asset.bytes).toBeGreaterThan(1000);

        await page.reload();
        await expect(page.getByTestId('render-refused')).toBeVisible();

        const other = await (await browser.newContext({ ...device.options, baseURL })).newPage();
        await other.goto(url);
        await expect(other.getByTestId('render-refused')).toBeVisible();

        await admin.storage.from(RENDER_BUCKET).remove([asset.url]);
      } finally {
        await browser.close();
      }
    });
  }
});
