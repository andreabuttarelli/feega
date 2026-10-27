import { randomUUID } from 'node:crypto';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2000;

test.describe('fullscreen output viewer @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('View shows prompt, model, seed and cost and steps between runs', async ({ page, session, admin, seedNode }) => {
    const first = randomUUID();
    const second = randomUUID();
    const node = await seedNode({ type: 'image', x: 0, y: 0, data: { prompt: 'a red shoe', refId: second } });
    const row = (output: string, seed: number, cost: number, at: string) => ({
      org_id: session.orgId,
      node_id: node.id,
      prompt: `shoe ${seed}`,
      model: 'mock/model',
      params: { seed },
      cost_usd: cost,
      status: 'done',
      output_asset_id: null as string | null,
      started_at: at,
      actor_kind: 'user',
      actor_id: session.userId,
      _output: output
    });
    for (const [output, seed, cost, at] of [[first, 11, 0.04, '2026-10-24T10:00:00Z'], [second, 22, 0.05, '2026-10-24T11:00:00Z']] as const) {
      const { _output, ...insert } = row(output, seed, cost, at);
      const { data: asset, error: assetError } = await admin
        .from('assets')
        .insert({ id: _output, org_id: session.orgId, project_id: session.projectId, type: 'image', source: 'generated' })
        .select('id')
        .single();
      expect(assetError).toBeNull();
      const { error } = await admin.from('node_runs').insert({ ...insert, output_asset_id: asset!.id });
      expect(error).toBeNull();
    }

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);

    const box = (await page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 20);
    await page.getByTestId('view-output').click();

    await expect(page.getByTestId('output-viewer')).toBeVisible();
    await expect(page.getByTestId('info-seed')).toHaveText('22');
    await expect(page.getByTestId('info-model')).toHaveText('mock/model');
    await expect(page.getByTestId('info-cost')).toHaveText('$0.05');
    await expect(page.getByTestId('info-prompt')).toHaveText('shoe 22');
    await page.screenshot({ path: `${SHOTS_DIR}/f4-viewer.png` });

    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('info-seed')).toHaveText('11');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('output-viewer')).toHaveCount(0);
  });
});
