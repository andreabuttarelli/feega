import type { Page } from '@playwright/test';
import { pickBarTool } from './fixtures/canvas-bar';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOTS_DIR } from './fixtures/shots';

const SETTLE_MS = 2500;
const WAVE_STEPS = 60;
const MAX_CURVES = 30;

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'a', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.9, y: 0.1, width: 0.1, height: 0.1, fills: [{ type: 'solid', color: '#ff5a1f' }] } }] }],
  comps: {},
  assets: []
};

type Clip = { id: string; props: Record<string, unknown> };

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS_DIR}/vec-pencil-${name}.png` });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('feega.frame-edit-mode', 'design'));
});

test.describe('pencil tool @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('a freehand stroke becomes a smoothed path, Shift draws a straight one', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, rotation: 0 } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frame = page.locator(`[data-frame="${node.id}"]`);
    await page.waitForTimeout(SETTLE_MS);
    const box = (await frame.boundingBox())!;
    const clips = async (): Promise<Clip[]> => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single();
      return (data!.doc as typeof doc).tracks.flatMap((t) => t.clips) as unknown as Clip[];
    };

    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.9);
    await page.waitForTimeout(SETTLE_MS);
    await pickBarTool(page, 'pencil');
    await expect(page.getByTestId('draw-overlay')).toHaveCount(1);
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.5, { steps: 4 });
    await page.waitForTimeout(500);
    await page.mouse.down();
    for (let i = 0; i <= WAVE_STEPS; i++) {
      const t = i / WAVE_STEPS;
      await page.mouse.move(box.x + box.width * (0.1 + 0.8 * t), box.y + box.height * (0.5 + 0.2 * Math.sin(t * Math.PI * 2)));
    }
    await shot(page, 'drawing');
    await page.mouse.up();
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'released');
    await pickBarTool(page, 'select');
    await page.waitForTimeout(SETTLE_MS);
    await expect.poll(async () => (await clips()).filter((c) => c.props.shape === 'path').length, { timeout: 30_000 }).toBe(1);
    const path = (await clips()).find((c) => c.props.shape === 'path')!;
    const curves = String(path.props.path).split('C').length - 1;
    expect(curves).toBeGreaterThan(2);
    expect(curves).toBeLessThan(MAX_CURVES);
    expect(String(path.props.path)).toContain('C');
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'smooth');

    await pickBarTool(page, 'pencil');
    await page.keyboard.down('Shift');
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.15, { steps: 4 });
    await page.waitForTimeout(500);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.2, { steps: 5 });
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.3, { steps: 5 });
    await shot(page, 'straight-drawing');
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await expect.poll(async () => (await clips()).filter((c) => c.props.shape === 'path').length, { timeout: 30_000 }).toBe(2);
    const straight = (await clips()).filter((c) => c.props.shape === 'path')[1];
    expect(String(straight.props.path)).not.toContain('C');
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'straight');
  });
});
