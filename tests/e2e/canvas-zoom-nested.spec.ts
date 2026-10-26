import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const FRAME_AT = { x: 200, y: 200 };
const FRAME_SIZE = { width: 800, height: 450 };
const VIEWPORT = { width: 1440, height: 900 };
const ORANGE: Rgb = [255, 90, 31];
const COLOUR_TOLERANCE = 40;
const SETTLE_MS = 6000;
const GROWS_BY = 1.5;

type Rgb = [number, number, number];
type Rect = { x: number; y: number; width: number; height: number };

const shape = (id: string, x: number, y: number, width: number, height: number, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x, y, width, height, fills: [{ type: 'solid', color }] } });

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape('bg', 0.5, 0.5, 1, 1, '#1b2a49'), shape('small', 0.3, 0.55, 0.12, 0.15, '#ff5a1f')] }],
  comps: {},
  assets: []
};

const near = (px: Rgb) => px.every((c, i) => Math.abs(c - ORANGE[i]) <= COLOUR_TOLERANCE);

async function orangeBounds(page: Page, area: Rect): Promise<Rect | null> {
  const { data, info } = await sharp(await page.screenshot({ clip: area })).raw().toBuffer({ resolveWithObject: true });
  const scale = info.width / area.width;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let y = 0; y < area.height; y++) {
    for (let x = 0; x < area.width; x++) {
      const i = (Math.round(y * scale) * info.width + Math.round(x * scale)) * info.channels;
      if (near([data[i], data[i + 1], data[i + 2]])) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
  }
  return x1 < 0 ? null : { x: area.x + x0, y: area.y + y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

test.use({ headless: !process.env.E2E_HEADED, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test.describe('zoom to an element inside a frame @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('Shift+2 on a nested selection zooms to the element, not the frame tile', async ({ page, session, admin, seedNode }) => {
    await page.setViewportSize(VIEWPORT);
    const node = await seedNode({ type: 'motion', x: FRAME_AT.x, y: FRAME_AT.y, data: LANDSCAPE });
    await admin.from('nodes').update({ width: FRAME_SIZE.width, height: FRAME_SIZE.height }).eq('id', node.id);
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    const tile = page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`);
    await expect(tile).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);

    const drawn = (await orangeBounds(page, (await tile.boundingBox())!))!;
    expect(drawn, 'the element is drawn').not.toBeNull();
    await page.mouse.click(drawn.x + drawn.width / 2, drawn.y + drawn.height / 2);
    const handles = page.getByTestId('frame-selection');
    await expect(handles).toHaveCount(1);
    const before = (await handles.boundingBox())!;
    await page.screenshot({ path: `${SHOTS_DIR}/r6-zoom-nested-before.png` });

    await page.keyboard.press('Shift+2');
    await page.waitForTimeout(SETTLE_MS);

    const after = (await handles.boundingBox())!;
    await page.screenshot({ path: `${SHOTS_DIR}/r6-zoom-nested-after.png` });
    expect(after.width, 'the view zoomed in on the element').toBeGreaterThan(before.width * GROWS_BY);
  });
});
