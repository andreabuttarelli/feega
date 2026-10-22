import { homedir } from 'node:os';
import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.FIG_SHOTS ?? `${homedir()}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2500;
const PLAYED_MS = 2000;
const INK_MIN = 170;
const TOLERANCE = 0.012;
const STAGE = { width: 1920, height: 1080 };

type Ink = { left: number; top: number; right: number; bottom: number };

const BASE = { text: 'Typography that holds from canvas to export, word for word\nline for line at every size', size: 0.045, color: '#ffffff', x: 0.5, y: 0.5, width: 0.42, height: 0.6, align: 'left' };

export const CASES: Record<string, Record<string, unknown>> = {
  justify: { align: 'justify' },
  bottom: { verticalAlign: 'bottom' },
  top: { verticalAlign: 'top' },
  paragraphs: { paragraphSpacing: 1, paragraphIndent: 2, verticalAlign: 'top' },
  title: { textCase: 'title' },
  'line-px': { lineHeight: '90px', verticalAlign: 'top' },
  'line-auto': { lineHeight: 'auto', verticalAlign: 'top' },
  'letter-percent': { letterSpacing: '8%' },
  'max-lines': { truncate: true, maxLines: 2, verticalAlign: 'top' },
  balance: { textWrap: 'balance' },
  pretty: { textWrap: 'pretty' },
  trim: { leadingTrim: 'cap', verticalAlign: 'top', lineHeight: '200%' }
};

const docOf = (props: Record<string, unknown>) => ({
  version: 5,
  fps: 30,
  ...STAGE,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'txt', component: 'Text', from: 0, durationInFrames: 150, props: { ...BASE, ...props } }] }],
  comps: {},
  assets: []
});

async function inkOf(png: Buffer): Promise<Ink> {
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const ink: Ink = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 3;
      if (Math.min(data[i], data[i + 1], data[i + 2]) < INK_MIN) {
        continue;
      }
      ink.left = Math.min(ink.left, x / info.width);
      ink.top = Math.min(ink.top, y / info.height);
      ink.right = Math.max(ink.right, x / info.width);
      ink.bottom = Math.max(ink.bottom, y / info.height);
    }
  }
  return ink;
}

async function exported(page: Page, html: string, path: string): Promise<Buffer> {
  const url = new URL('/__text-export', page.url()).href;
  await page.route(url, (route) => route.fulfill({ contentType: 'text/html', body: html }));
  await page.setViewportSize(STAGE);
  await page.goto(url);
  await page.waitForTimeout(PLAYED_MS);
  return page.screenshot({ path, clip: { x: 0, y: 0, ...STAGE } });
}

test.describe('text typography: canvas and export draw the same block @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');
  test.use({ viewport: { width: 1600, height: 1000 } });

  for (const [name, props] of Object.entries(CASES)) {
    test(`${name}: same ink box on the canvas and in the export`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(120_000);
      const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: docOf(props), actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      const host = page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`);
      await expect(host).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(SETTLE_MS);
      await page.addStyleTag({ content: '[data-testid="frame-overlays"] .selection{display:none!important}' });
      const canvas = await inkOf(await page.screenshot({ path: `${SHOTS}/text-${name}-canvas.png`, clip: (await host.boundingBox())! }));

      const preview = await page.request.get(`/p/${session.projectId}/c/${session.canvasId}/motion/${frame.id}/preview`);
      expect(preview.ok()).toBe(true);
      const html = (await preview.json()).html as string;
      const exportInk = await inkOf(await exported(page, html, `${SHOTS}/text-${name}-export.png`));

      for (const side of ['left', 'top', 'right', 'bottom'] as const) {
        expect(Math.abs(canvas[side] - exportInk[side]), `${name} ${side}: canvas ${canvas[side]} export ${exportInk[side]}`).toBeLessThanOrEqual(TOLERANCE);
      }
    });
  }
});
