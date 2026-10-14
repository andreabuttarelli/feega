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

  test('play in the node advances the frame without selecting or moving it', async ({ page, session }) => {
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const stage = page.getByTestId('motion-node-stage');
    await expect(page.locator('hyperframes-player')).toHaveCount(0, { timeout: 15_000 });
    const play = page.getByRole('button', { name: 'Play', exact: true });

    const node = page.locator('.svelte-flow__node').filter({ has: stage });
    const before = await node.boundingBox();
    const still = await stage.screenshot();
    await shoot(page, 'paused');

    await play.click();
    const timecode = page.getByTestId('motion-node-timecode');
    await expect(timecode).toBeVisible({ timeout: 15_000 });
    const start = await timecode.textContent();
    await expect(timecode).not.toHaveText(start ?? '', { timeout: 5000 });
    await page.waitForTimeout(600);
    await shoot(page, 'playing');
    expect((await stage.screenshot()).equals(still)).toBe(false);

    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(node).not.toHaveClass(/selected/);
    expect(await node.boundingBox()).toEqual(before);

    await page.getByRole('button', { name: 'Go to start', exact: true }).click();
    await expect(timecode).toHaveText(/^00:00:00 \//);
  });
});
