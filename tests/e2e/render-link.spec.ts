import { createHash, randomBytes } from 'node:crypto';
import { chromium, devices, webkit, type BrowserType } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const SHORT = { ...doc, durationInFrames: 20 };
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const OPEN_MS = 30 * 60_000;
const RENDER_TIMEOUT_MS = 120_000;
const BUCKET = 'canvas-assets';
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
      const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
      await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: SHORT, actor_kind: 'user', actor_id: session.userId });

      const secret = randomBytes(32).toString('base64url');
      const params = { kind: 'browser-render', revision: 1, link: { hash: createHash('sha256').update(secret).digest('hex'), expiresAt: new Date(Date.now() + OPEN_MS).toISOString(), claim: null }, actor: { kind: 'agent', id: session.userId, agentKey: 'mcp' } };
      const { data: run, error } = await admin.from('node_runs').insert({ org_id: session.orgId, node_id: node.id, prompt: 'e2e', model: 'browser', params, status: 'running', external_job_id: 'browser-render:1', actor_kind: 'agent', actor_id: session.userId }).select('id').single();
      expect(error).toBeNull();
      const url = `/render/${run!.id}.${secret}`;

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

        const { data: closed } = await admin.from('node_runs').select('status, output_asset_id').eq('id', run!.id).single();
        expect(closed).toMatchObject({ status: 'done' });
        const { data: asset } = await admin.from('assets').select('url, mime_type, bytes').eq('id', closed!.output_asset_id!).single();
        expect(asset).toMatchObject({ mime_type: 'video/mp4' });
        expect(Number(asset!.bytes)).toBeGreaterThan(1000);

        await page.reload();
        await expect(page.getByTestId('render-refused')).toBeVisible();

        const other = await (await browser.newContext({ ...device.options, baseURL })).newPage();
        await other.goto(url);
        await expect(other.getByTestId('render-refused')).toBeVisible();

        await admin.storage.from(BUCKET).remove([asset!.url!]);
      } finally {
        await browser.close();
      }
    });
  }
});
