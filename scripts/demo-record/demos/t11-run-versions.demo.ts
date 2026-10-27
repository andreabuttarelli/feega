import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { asset, openCanvas } from './seed';

const NODE_AT = { x: 200, y: 120 };

const VERSIONS = [
  { image: '/templates/product-lifestyle.webp', prompt: 'Stoneware mug on a linen table, soft morning light', params: { aspect: '4:5', style: 'natural' } },
  { image: '/templates/product-3d.webp', prompt: 'Stoneware mug on a linen table, hard noon light', params: { aspect: '1:1', style: 'studio' } }
];

test('compare two generation versions', async ({ page, session, admin, seedNode }) => {
  const assetIds: string[] = [];
  for (const version of VERSIONS) {
    const row = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'image', source: 'imported', url: asset(version.image) }).select('id').single();
    expect(row.error).toBeNull();
    assetIds.push(row.data!.id);
  }

  const node = await seedNode({ type: 'image', x: NODE_AT.x, y: NODE_AT.y, data: { prompt: VERSIONS[1].prompt, model: 'e2e/demo-model', refId: assetIds[1] } });
  for (const [i, version] of VERSIONS.entries()) {
    const run = await admin.from('node_runs').insert({
      org_id: session.orgId,
      node_id: node.id,
      prompt: version.prompt,
      model: 'e2e/demo-model',
      params: version.params,
      status: 'done',
      output_asset_id: assetIds[i],
      started_at: new Date(Date.now() - (VERSIONS.length - i) * 60_000).toISOString(),
      finished_at: new Date(Date.now() - (VERSIONS.length - i) * 60_000 + 5000).toISOString(),
      actor_kind: 'user',
      actor_id: session.userId
    });
    expect(run.error).toBeNull();
  }

  await installCursor(page);
  await openCanvas(page, session);
  const tile = page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`);
  await expect(tile).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const box = (await tile.boundingBox())!;

  await recordDemo(page, { slug: 't11-run-versions', title: 'compare generation versions' }, async (d) => {
    await d.click({ x: box.x + box.width / 2, y: box.y + box.height - 20 });
    const history = page.locator('[data-control="history"]');
    await expect(history).toBeVisible({ timeout: 15_000 });
    await d.click(history);
    await d.click(page.getByTestId('history-compare'));
    const tiles = page.getByTestId('variants-history').getByRole('button');
    await d.click(tiles.nth(0));
    await d.click(tiles.nth(1));
    await expect(page.getByTestId('compare-overlay')).toBeVisible({ timeout: 15_000 });
    await d.wait(1200);
    const handle = page.getByTestId('compare-handle');
    const hb = (await handle.boundingBox())!;
    await d.drag({ x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 }, { x: hb.x - 260, y: hb.y + hb.height / 2 });
    await d.look(((await page.getByTestId('params-diff').boundingBox())!), 3200);
    await d.key('Escape', 'Esc');
    await d.wait(800);
  });
});
