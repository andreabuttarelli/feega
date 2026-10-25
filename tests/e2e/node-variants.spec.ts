import { test, expect, gotoHydrated } from './fixtures/session';

const SHOTS_DIR = `${process.env.HOME}/Documents/feega-videos/e2e`;
const SETTLE_MS = 2000;
const VARIANTS = 4;
const RENDER_TIMEOUT_MS = 90_000;

test.skip(!process.env.E2E_REAL_STACK || !process.env.E2E_FAKE_IMAGES, '@real: needs a real stack and the fake image provider (E2E_FAKE_IMAGES=1)');

const imageNode = (into: 'nodes' | 'history') => ({
  type: 'image',
  x: 0,
  y: 0,
  data: { prompt: 'a lake at dawn', model: 'nano-banana-2', params: { aspectRatio: '1:1', provider: 'openrouter', variants: VARIANTS, variantsInto: into } }
});

test.describe('variants on an image node @real', () => {
  test.setTimeout(240_000);

  test('4 variants into separate nodes make 4 wired nodes next to the source', async ({ page, session, admin, seedNode }) => {
    const input = await seedNode({ type: 'text', x: -700, y: 0, data: { prompt: 'a calm lake' } });
    const source = await seedNode(imageNode('nodes'));
    const wire = await admin.from('nodes_connections').insert({ org_id: session.orgId, canvas_id: session.canvasId, source_node_id: input.id, target_node_id: source.id, source_handle: null, target_handle: null, mode: 'fixed' });
    expect(wire.error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);

    const box = (await page.locator(`[data-testid="gpu-node"][data-id="${source.id}"]`).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 20);

    await expect(page.locator('[data-control="variants"]')).toContainText(`×${VARIANTS}`);
    await expect(page.locator('[data-control="run"]')).toContainText(`×${VARIANTS}`);
    await page.locator('[data-control="variants"]').click();
    await expect(page.getByRole('radio', { name: 'Separate nodes' })).toHaveAttribute('aria-checked', 'true');
    await page.screenshot({ path: `${SHOTS_DIR}/variants-picker.png` });
    await page.locator('[data-control="variants"]').click();

    await page.locator('[data-control="run"]').click();

    await expect
      .poll(async () => (await admin.from('nodes').select('id, data, x').eq('canvas_id', session.canvasId).eq('type', 'image').is('deleted_at', null)).data?.filter((n) => (n.data as { refId?: string }).refId).length, { timeout: RENDER_TIMEOUT_MS })
      .toBe(VARIANTS);

    const nodes = (await admin.from('nodes').select('id, data, x, y').eq('canvas_id', session.canvasId).eq('type', 'image').is('deleted_at', null)).data ?? [];
    const made = nodes.filter((n) => n.id !== source.id);
    expect(made).toHaveLength(VARIANTS);
    expect(made.every((n) => n.x > 0)).toBe(true);
    expect(nodes.find((n) => n.id === source.id)?.data).not.toHaveProperty('refId');

    const wired = (await admin.from('nodes_connections').select('source_node_id, target_node_id').eq('canvas_id', session.canvasId).is('deleted_at', null)).data ?? [];
    expect(wired.filter((w) => w.source_node_id === input.id && made.some((n) => n.id === w.target_node_id))).toHaveLength(VARIANTS);

    await expect(page.locator('[data-testid="gpu-node"]')).toHaveCount(2 + VARIANTS, { timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS_DIR}/variants-nodes.png` });
  });

  test('4 variants into node history fill the history and one can be picked', async ({ page, session, admin, seedNode }) => {
    const node = await seedNode(imageNode('history'));

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('[data-canvas-surface]')).toHaveAttribute('data-renderer', 'core', { timeout: 30_000 });
    await page.waitForTimeout(SETTLE_MS);

    const box = (await page.locator(`[data-testid="gpu-node"][data-id="${node.id}"]`).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 20);

    await page.locator('[data-control="variants"]').click();
    await expect(page.getByRole('radio', { name: 'Node history' })).toHaveAttribute('aria-checked', 'true');
    await page.locator('[data-control="variants"]').click();
    await page.locator('[data-control="run"]').click();

    await expect
      .poll(async () => (await admin.from('node_runs').select('id').eq('node_id', node.id).eq('status', 'done')).data?.length, { timeout: RENDER_TIMEOUT_MS })
      .toBe(VARIANTS);
    expect((await admin.from('nodes').select('id').eq('canvas_id', session.canvasId).eq('type', 'image').is('deleted_at', null)).data).toHaveLength(1);
    await expect.poll(async () => (await admin.from('nodes').select('data').eq('id', node.id).single()).data?.data).toMatchObject({ running: false });

    await page.locator('[data-control="history"]').click();
    const history = page.getByTestId('variants-history');
    await expect(history.getByRole('button')).toHaveCount(VARIANTS, { timeout: 30_000 });
    await page.screenshot({ path: `${SHOTS_DIR}/variants-history.png` });

    const runs = (await admin.from('node_runs').select('output_asset_id, started_at').eq('node_id', node.id).order('started_at')).data ?? [];
    const first = runs[0].output_asset_id as string;
    await history.getByRole('button').first().click();

    await expect.poll(async () => (await admin.from('nodes').select('data').eq('id', node.id).single()).data?.data).toMatchObject({ refId: first });
    await expect(history.getByRole('button').first()).toHaveAttribute('aria-pressed', 'true');
    await page.screenshot({ path: `${SHOTS_DIR}/variants-history-picked.png` });
  });
});
