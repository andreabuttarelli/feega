import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';

const SETTLE_MS = 3000;
const FAR = 1500;
const STRIP_HEIGHT = 30;
const ICON_CLEARANCE_PX = 24;
const STRIP_WIDTH_PX = 400;
const MIN_TEXT_PIXELS = 20;
const INK_DELTA = 200;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = `${process.env.HOME}/Documents/feega-videos/e2e`;

const shape = { id: 'a', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.3, y: 0.5, width: 0.2, height: 0.2 } };
const shadow = { id: 'fx', kind: 'drop-shadow', enabled: true, params: { distance: 10, blur: 8 } };

const docWith = (clip: Record<string, unknown>) => ({
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [clip] }],
  comps: {},
  assets: []
});

async function inkAfterIcon(page: Page, stage: { x: number; y: number; width: number }): Promise<number> {
  const clip = { x: stage.x + ICON_CLEARANCE_PX, y: stage.y - STRIP_HEIGHT, width: Math.min(stage.width, STRIP_WIDTH_PX) - ICON_CLEARANCE_PX, height: STRIP_HEIGHT - 4 };
  const png = (await page.screenshot({ clip })).toString('base64');
  return page.evaluate(
    async ([data, delta]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${data}`;
      await img.decode();
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, img.width, img.height).data;
      let ink = 0;
      for (let i = 4; i < px.length; i += 4) {
        const away = Math.abs(px[i] - px[0]) + Math.abs(px[i + 1] - px[1]) + Math.abs(px[i + 2] - px[2]);
        ink += away > Number(delta) ? 1 : 0;
      }
      return ink;
    },
    [png, String(INK_DELTA)] as const
  );
}

const RETINA = 2;

test.use({ deviceScaleFactor: RETINA });

test.describe('frame titles and picking on the core canvas @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('the frame title is drawn above the tile, named and after reload', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const frame = await seedNode({ type: 'motion', x: FAR, y: FAR, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: docWith(shape), actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    await admin.from('nodes').update({ display_name: 'Titled frame with a long name' }).eq('id', frame.id);

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    const stage = (await page.locator(`[data-motion-node="${frame.id}"] [data-frame-stage]`).boundingBox())!;
    await page.screenshot({ path: `${SHOTS}/titles-named.png` });
    expect(await inkAfterIcon(page, stage), 'text ink right of the icon').toBeGreaterThan(MIN_TEXT_PIXELS);

    await page.reload();
    await page.waitForTimeout(SETTLE_MS);
    const again = (await page.locator(`[data-motion-node="${frame.id}"] [data-frame-stage]`).boundingBox())!;
    await page.screenshot({ path: `${SHOTS}/titles-reload.png` });
    expect(await inkAfterIcon(page, again), 'text ink after reload').toBeGreaterThan(MIN_TEXT_PIXELS);
  });

  test('clicking a clip with a shadow picks it on the canvas', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: docWith({ ...shape, effects: [shadow] }), actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    const stage = (await page.locator(`[data-motion-node="${frame.id}"] [data-frame-stage]`).boundingBox())!;
    const element = { x: stage.x + stage.width * 0.4, y: stage.y + stage.height * 0.5 };
    await page.mouse.click(element.x, element.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(element.x, element.y);
    await page.screenshot({ path: `${SHOTS}/titles-picked-shadow.png` });
    await expect(page.getByTestId('frame-selection')).toHaveCount(1, { timeout: 15_000 });
  });
});
