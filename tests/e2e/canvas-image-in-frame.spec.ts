import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import path from 'node:path';
import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { SHOTS_DIR } from './fixtures/shots';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const VIEWPORT = { width: 1440, height: 900 };
const BLUE_SQUARE = path.join(import.meta.dirname, 'fixtures', 'blue-square.png');
const FRAME_CLICK = { x: 392 + 0.3 * 420, y: 356 + 0.5 * 236 };
const FRAME_CENTRE = { x: 392 + 0.5 * 420, y: 356 + 0.5 * 236 };
const SETTLE_MS = 4000;
const SHOWN_WITHIN_MS = 1000;
const SAVED_WITHIN_MS = 30_000;
const SAMPLE = 6;

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [] }],
  comps: {},
  assets: []
};

async function centreIsBlue(page: Page): Promise<boolean> {
  const shot = await page.screenshot({ clip: { x: FRAME_CENTRE.x - SAMPLE / 2, y: FRAME_CENTRE.y - SAMPLE / 2, width: SAMPLE, height: SAMPLE } });
  const { data } = await sharp(shot).resize(1, 1).raw().toBuffer({ resolveWithObject: true });
  return data[2] > 150 && data[0] < 120;
}

test.describe('an image inserted into a selected frame @real', () => {
  test.skip(!REAL_STACK, 'requires E2E_REAL_STACK=1');

  test('shows at once on the canvas and in the layers, and survives a reload', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', x: 200, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await page.setViewportSize(VIEWPORT);
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS_DIR}/imgframe-1-empty-frame.png` });

    const bar = page.getByTestId('add-bar');
    await expect(async () => {
      await page.mouse.click(FRAME_CLICK.x, FRAME_CLICK.y);
      await expect(bar).toHaveAttribute('data-context', 'frame', { timeout: 1500 });
    }).toPass({ timeout: 25_000 });

    await bar.getByTestId('frame-image-input').setInputFiles(BLUE_SQUARE);

    await expect(page.getByRole('button', { name: /^Select Image/ })).toBeVisible({ timeout: SHOWN_WITHIN_MS });
    await expect.poll(() => centreIsBlue(page), { timeout: SHOWN_WITHIN_MS }).toBe(true);
    await page.screenshot({ path: `${SHOTS_DIR}/imgframe-2-inserted.png` });

    await expect
      .poll(
        async () => {
          const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1);
          const saved = data?.[0]?.doc as { tracks: { clips: { component: string }[] }[] } | undefined;
          return saved?.tracks.flatMap((t) => t.clips).some((c) => c.component === 'Image');
        },
        { timeout: SAVED_WITHIN_MS }
      )
      .toBe(true);

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    await expect.poll(() => centreIsBlue(page), { timeout: 15_000 }).toBe(true);
    await page.screenshot({ path: `${SHOTS_DIR}/imgframe-3-after-reload.png` });
  });
});
