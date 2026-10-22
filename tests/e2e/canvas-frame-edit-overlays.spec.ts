import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.SHOT_PREFIX ?? '';
const SETTLE_MS = 2500;
const ROTATION = 20;
const ALIGN_TOLERANCE_PX = 6;
const linear = (frame: number, value: number) => ({ frame, value, ease: 'linear' });
const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  layoutGuides: [{ kind: 'columns', count: 6, gutter: 40, margin: 80, size: 8 }],
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [
        { id: 'a', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.3, y: 0.5, width: 0.25, height: 0.4, fills: [{ type: 'solid', color: '#ff5a1f' }] } },
        {
          id: 'p',
          from: 0,
          durationInFrames: 150,
          component: 'Shape',
          path: { autoOrient: false, tangents: [] },
          keyframes: { x: [linear(0, 0), linear(60, 0.25)], y: [linear(0, 0), linear(60, -0.2)] },
          props: { shape: 'ellipse', x: 0.7, y: 0.6, width: 0.1, height: 0.15, fills: [{ type: 'solid', color: '#1f5aff' }] }
        }
      ]
    }
  ],
  comps: {},
  assets: []
};

type Clip = { id: string; props: Record<string, unknown> };

async function shot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}-${name}.png` });
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('feega.frame-edit-mode', 'design'));
});

test.describe('corner, path, outline, grid and guides on a canvas frame @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  for (const rotation of [0, ROTATION]) {
    test(`rotation ${rotation}`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 1440, height: 900 });
      const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, rotation } });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      const clips = async (): Promise<Clip[]> => {
        const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single();
        return (data!.doc as typeof doc).tracks.flatMap((t) => t.clips) as Clip[];
      };

      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      const frame = page.locator(`[data-frame="${node.id}"]`);
      await page.waitForTimeout(SETTLE_MS);
      const box = (await frame.boundingBox())!;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(SETTLE_MS);
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.locator('[data-layer="a"]').click();

      await expect(page.getByTestId('layout-guides')).toHaveCount(1, { timeout: 15_000 });
      const corners = page.getByTestId('corner-overlay');
      await expect(corners).toHaveCount(1, { timeout: 15_000 });
      const body = (await page.getByTestId('frame-selection-body').boundingBox())!;
      const knob = (await corners.locator('[data-corner="0"]').boundingBox())!;
      const knobAt = { x: knob.x + knob.width / 2, y: knob.y + knob.height / 2 };
      expect(knobAt.x).toBeGreaterThan(body.x - ALIGN_TOLERANCE_PX);
      expect(knobAt.x).toBeLessThan(body.x + body.width + ALIGN_TOLERANCE_PX);
      expect(knobAt.y).toBeGreaterThan(body.y - ALIGN_TOLERANCE_PX);
      expect(knobAt.y).toBeLessThan(body.y + body.height + ALIGN_TOLERANCE_PX);
      await shot(page, `${rotation}-corners`);

      const centre = { x: body.x + body.width / 2, y: body.y + body.height / 2 };
      await page.mouse.move(knobAt.x, knobAt.y);
      await page.mouse.down();
      await page.mouse.move(knobAt.x + (centre.x - knobAt.x) * 0.4, knobAt.y + (centre.y - knobAt.y) * 0.4, { steps: 8 });
      await page.mouse.up();
      await expect.poll(async () => ((await clips()).find((c) => c.id === 'a')!.props.corners as number[] | undefined)?.[0] ?? 0, { timeout: 30_000 }).toBeGreaterThan(0.05);
      await shot(page, `${rotation}-rounded`);

      await page.locator('[data-layer="p"]').click();
      await expect(page.getByTestId('path-overlay')).toHaveCount(1, { timeout: 15_000 });
      await shot(page, `${rotation}-path`);

      await page.mouse.move(box.x + box.width / 2, box.y + box.height + 40);
      await page.keyboard.press('Shift+G');
      await expect(page.getByTestId('layout-guides')).toHaveCount(0);
      await page.keyboard.press('ControlOrMeta+y');
      await expect(page.getByTestId('outline-view')).toHaveCount(1);
      await expect(page.locator('[data-outline="a"]')).toHaveCount(1);
      await shot(page, `${rotation}-outlines`);
    });
  }
});
