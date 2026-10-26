import sharp from 'sharp';
import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const FRAME_AT = { x: 200, y: 200 };
const FRAME_SIZE = { width: 800, height: 450 };
const VIEWPORT = { width: 1440, height: 900 };
const DOC_WIDTH = 1920;
const SETTLE_MS = 6000;
const SHORT_SETTLE_MS = 1200;
const COLOUR_TOLERANCE = 40;
const GAP_DOC_PX = 40;
const GAP_TOLERANCE_PX = 3;

type Rgb = [number, number, number];
type Rect = { x: number; y: number; width: number; height: number };

const ORANGE: Rgb = [255, 90, 31];
const GREEN: Rgb = [47, 191, 113];
const BLUE: Rgb = [59, 130, 246];

const shape = (id: string, x: number, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x, y: 0.5, width: 0.12, height: 0.2, fills: [{ type: 'solid', color }] } });

const doc = {
  version: 5,
  fps: 30,
  width: DOC_WIDTH,
  height: 1080,
  durationInFrames: 150,
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape('a', 0.15, '#ff5a1f'), shape('b', 0.3, '#2fbf71'), shape('c', 0.8, '#3b82f6')] }],
  comps: {},
  assets: []
};

const near = (px: Rgb, want: Rgb) => px.every((c, i) => Math.abs(c - want[i]) <= COLOUR_TOLERANCE);

async function colourBounds(page: Page, area: Rect, want: Rgb): Promise<Rect> {
  const { data, info } = await sharp(await page.screenshot({ clip: area })).raw().toBuffer({ resolveWithObject: true });
  const scale = info.width / area.width;
  let x0 = Infinity;
  let x1 = -Infinity;
  for (let y = 0; y < area.height; y += 2) {
    for (let x = 0; x < area.width; x++) {
      const i = (Math.round(y * scale) * info.width + Math.round(x * scale)) * info.channels;
      if (near([data[i], data[i + 1], data[i + 2]], want)) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
      }
    }
  }
  return { x: area.x + x0, y: area.y, width: x1 - x0 + 1, height: area.height };
}

test.use({ headless: !process.env.E2E_HEADED, launchOptions: { args: ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

test.describe('distribute with an exact gap @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('typing a gap and distributing puts exactly that gap between the elements', async ({ page, session, admin, seedNode }) => {
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

    const frame = (await tile.boundingBox())!;
    const strip: Rect = { x: frame.x, y: frame.y + frame.height * 0.45, width: frame.width, height: frame.height * 0.1 };
    await page.mouse.click(frame.x + frame.width * 0.15, frame.y + frame.height * 0.5);
    await expect(page.getByTestId('frame-selection')).toHaveCount(1);
    await page.keyboard.press('ControlOrMeta+a');
    await page.waitForTimeout(SHORT_SETTLE_MS);

    await page.getByTestId('distribute-spacing').fill(String(GAP_DOC_PX));
    await page.locator('[data-distribute="x"]').click();
    await page.waitForTimeout(SHORT_SETTLE_MS);
    await page.screenshot({ path: `${SHOTS_DIR}/r6-distribute-spacing.png` });

    const [a, b, c] = await Promise.all([ORANGE, GREEN, BLUE].map((colour) => colourBounds(page, strip, colour)));
    const gapPx = (GAP_DOC_PX * frame.width) / DOC_WIDTH;
    expect(Math.abs(c.x - (b.x + b.width) - gapPx), 'green to blue').toBeLessThanOrEqual(GAP_TOLERANCE_PX);
    expect(Math.abs(b.x - (a.x + a.width) - gapPx), 'orange to green').toBeLessThanOrEqual(GAP_TOLERANCE_PX);
  });
});
