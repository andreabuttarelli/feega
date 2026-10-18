import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.MOTION_NODE_SHOTS;

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

test.describe('motion node on the canvas @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test.beforeEach(async ({ session, admin, seedNode }, info) => {
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    info.annotations.push({ type: 'node', description: node.id });
  });

  test('the selection border frames the visible body of the node', async ({ page, session }) => {
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const body = page.getByTestId('motion-node');
    const stage = page.getByTestId('motion-node-stage');
    await stage.click({ position: { x: 4, y: 4 } });
    await shoot(page, 'selected');

    const selected = await page.locator('.svelte-flow__node.selected').boundingBox();
    const visible = await body.boundingBox();
    const picture = await stage.boundingBox();
    expect(selected).not.toBeNull();
    expect(visible).toEqual(selected);
    expect(picture!.x).toBeCloseTo(selected!.x + 1, 0);
    expect(picture!.width).toBeCloseTo(selected!.width - 2, 0);
    expect(picture!.width / picture!.height).toBeCloseTo(16 / 9, 1);
  });

  test('a frame tile has no playback controls; the editor stays one click away', async ({ page, session }) => {
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const stage = page.getByTestId('motion-node-stage').first();
    await expect(stage).toBeVisible({ timeout: 15_000 });
    const node = page.locator('.svelte-flow__node').filter({ has: stage });
    for (const name of ['Play', 'Pause', 'Stop', 'Go to start', 'Go to end', 'Loop', 'Mute', 'Unmute', 'Seek']) {
      await expect(node.getByRole('button', { name, exact: true }), `no ${name} on the tile`).toHaveCount(0);
    }
    await expect(page.getByTestId('motion-node-timecode')).toHaveCount(0);
    await expect(page.locator('hyperframes-player')).toHaveCount(0);
  });
});
