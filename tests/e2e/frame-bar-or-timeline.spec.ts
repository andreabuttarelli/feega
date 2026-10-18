import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const video = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'b', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.3, height: 0.3 } }] }], comps: {}, assets: [] };

test.use({ video: process.env.E2E_VIDEO ? 'on' : 'off' });

test.describe('an open frame shows the add bar or the timeline, never both @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.describe.configure({ timeout: 120_000 });

  test('Design: bar, no timeline; Motion: timeline, no bar; E swaps them', async ({ page, session, admin, seedNode }) => {
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: video, actor_kind: 'user', actor_id: session.userId });

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').click({ position: { x: 20, y: 10 } });
    await expect(page.getByTestId('motion-editor')).toBeVisible({ timeout: 15_000 });
    const bar = page.getByTestId('add-bar');
    const timeline = page.locator('section[aria-label="Timeline"]');
    const modes = page.getByTestId('edit-mode');

    await modes.locator('[data-mode="design"]').click();
    await expect(bar).toHaveCSS('opacity', '1');
    await expect(timeline).toHaveAttribute('inert', '');
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/frame-design.png` });
    }

    await modes.locator('[data-mode="motion"]').click();
    await expect(bar).toHaveCSS('opacity', '0');
    await expect(bar).toHaveAttribute('inert', '');
    await expect(timeline).not.toHaveAttribute('inert', '');
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/frame-motion.png` });
    }

    await page.getByTestId('editor-stage').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('e');
    await expect(bar).toHaveCSS('opacity', '1');
    await expect(timeline).toHaveAttribute('inert', '');
  });
});
