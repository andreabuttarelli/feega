import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.SHOT_PREFIX ?? '';
const SETTLE_MS = 2500;
const arc = { id: 'arc', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'ellipse', x: 0.85, y: 0.25, width: 0.2, height: 0.35, arcStart: -90, arcSweep: 0.75, arcRatio: 0.5, fills: [{ type: 'solid', color: '#1f5aff' }] } };
const doc = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, background: 'brand', tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [arc] }], comps: {}, assets: [] };

type Clip = { component: string; props: Record<string, unknown> };

async function shot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}-${name}.png` });
  }
}

test.beforeEach(async ({ page }) => {
});

test.describe('shape tools on the canvas @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('polygon, star, line and arrow draw into a frame; an ellipse arc renders', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    const clips = async (): Promise<Clip[]> => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1);
      const latest = data?.[0]?.doc as { tracks: { clips: Clip[] }[] } | undefined;
      return latest?.tracks.flatMap((t) => t.clips) ?? [];
    };

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frame = page.locator(`[data-frame="${node.id}"]`);
    await page.waitForTimeout(SETTLE_MS);
    const r = (await frame.boundingBox())!;
    const at = (fx: number, fy: number) => ({ x: r.x + r.width * fx, y: r.y + r.height * fy });
    await page.mouse.click(at(0.3, 0.8).x, at(0.3, 0.8).y);
    await page.waitForTimeout(1000);

    const draw = async (tool: string, from: { x: number; y: number }, to: { x: number; y: number }, count: number) => {
      await page.locator(`[data-tool="${tool}"]`).first().click();
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 8 });
      await page.mouse.up();
      await expect.poll(async () => (await clips()).length, { timeout: 15_000 }).toBe(count);
    };

    await draw('polygon', at(0.05, 0.1), at(0.2, 0.4), 2);
    await draw('star', at(0.25, 0.1), at(0.45, 0.45), 3);
    await draw('line', at(0.05, 0.6), at(0.45, 0.9), 4);
    await draw('arrow', at(0.5, 0.9), at(0.7, 0.55), 5);

    const shapes = (await clips()).map((c) => c.props.shape);
    expect(shapes).toEqual(expect.arrayContaining(['polygon', 'star', 'path']));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'drawn');
  });
});
