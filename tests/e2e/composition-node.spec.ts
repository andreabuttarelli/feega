import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const MOTION = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };

test.describe('composition node fed by a connected node @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('the canvas reloads with the composition previewing its input', async ({ page, session, admin, seedNode }) => {
    const motion = await seedNode({ type: 'motion', x: 0, y: 0, data: MOTION });
    const revision = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: motion.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(revision.error).toBeNull();

    const composition = await seedNode({
      type: 'composition',
      x: 600,
      y: 0,
      data: {
        layout: 'bento',
        layoutParams: { columns: 2, rows: 2, gap: 24, cornerRadius: 0 },
        camera: { preset: 'static', params: {} },
        background: { color: '#f4f1ea' },
        duration: 8,
        aspect: '9:16',
        refId: null,
        cells: { [motion.id]: { columns: 2 } }
      }
    });
    const edge = await admin.from('nodes_connections').insert({
      org_id: session.orgId,
      canvas_id: session.canvasId,
      source_node_id: motion.id,
      target_node_id: composition.id,
      target_handle: 'motions',
      actor_kind: 'user',
      actor_id: session.userId
    });
    expect(edge.error).toBeNull();

    const crashes: string[] = [];
    page.on('pageerror', (error) => crashes.push(error.message));
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.reload();

    await expect(page.locator('.composition-preview')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('motion-node-stage')).toBeVisible();
    await expect(page.locator('.node-failed')).toHaveCount(0);
    expect(crashes).toEqual([]);
  });
});

const PREVIEW_FRAME = 'about:srcdoc';
const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test.describe('composition node fed by an uploaded image @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('the image cell loads its picture inside the preview', async ({ page, session, admin, seedNode }) => {
    const path = `${session.orgId}/${session.projectId}/${crypto.randomUUID()}.png`;
    const upload = await admin.storage.from('canvas-assets').upload(path, PNG_1PX, { contentType: 'image/png' });
    expect(upload.error).toBeNull();
    const asset = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'image', source: 'upload', url: path, mime_type: 'image/png' }).select('id').single();
    expect(asset.error).toBeNull();

    const image = await seedNode({ type: 'image', x: 0, y: 0, data: { refId: asset.data!.id } });
    const composition = await seedNode({
      type: 'composition',
      x: 600,
      y: 0,
      data: { layout: 'bento', layoutParams: { columns: 1, rows: 1, gap: 0, cornerRadius: 0 }, camera: { preset: 'static', params: {} }, background: { color: '#000000' }, duration: 4, aspect: '1:1', refId: null, cells: {} }
    });
    const edge = await admin.from('nodes_connections').insert({ org_id: session.orgId, canvas_id: session.canvasId, source_node_id: image.id, target_node_id: composition.id, target_handle: 'images', actor_kind: 'user', actor_id: session.userId });
    expect(edge.error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator('.composition-preview')).toBeVisible({ timeout: 15_000 });

    const loadedImages = async () => {
      for (const frame of page.frames().filter((f) => f.url() === PREVIEW_FRAME)) {
        const loaded = await frame.evaluate(() => [...document.images].some((img) => img.complete && img.naturalWidth > 0)).catch(() => false);
        if (loaded) {
          return true;
        }
      }
      return false;
    };
    await expect.poll(loadedImages, { timeout: 15_000 }).toBe(true);
  });
});
