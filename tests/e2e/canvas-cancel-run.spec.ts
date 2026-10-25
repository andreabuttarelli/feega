import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2000;

test.describe('cancel one running generation @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('Stop closes the run cancelled and frees the node', async ({ page, session, admin, seedNode }) => {
    const node = await seedNode({ type: 'image', x: 0, y: 0, data: { prompt: 'a red shoe' } });
    const { data: run, error } = await admin
      .from('node_runs')
      .insert({ org_id: session.orgId, node_id: node.id, prompt: 'a red shoe', model: 'mock', params: {}, status: 'running', actor_kind: 'user', actor_id: session.userId })
      .select('id')
      .single();
    expect(error).toBeNull();
    await admin.from('nodes').update({ data: { prompt: 'a red shoe', running: true, runId: run!.id } }).eq('id', node.id);

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);

    const box = (await page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 20);
    await expect(page.getByTestId('stop-run')).toBeVisible();
    await page.screenshot({ path: `${SHOTS_DIR}/f4-cancel-run-before.png` });

    await page.getByTestId('stop-run').click();

    await expect
      .poll(async () => (await admin.from('node_runs').select('status, error').eq('id', run!.id).single()).data)
      .toMatchObject({ status: 'failed', error: 'cancelled' });
    await expect
      .poll(async () => ((await admin.from('nodes').select('data').eq('id', node.id).single()).data?.data as { running?: boolean }).running)
      .toBe(false);
    await expect(page.getByTestId('stop-run')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS_DIR}/f4-cancel-run-after.png` });
  });
});
