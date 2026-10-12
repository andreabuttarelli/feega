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

const SHOTS = process.env.E2E_SHOTS_DIR;
const SWATCHES = ['#e4572e', '#29335c', '#f3a712'];

test.describe('composition node on a library component @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('picks a component and plays the three wired images in it', async ({ page, session, admin, seedNode }) => {
    const sharp = (await import('sharp')).default;
    const composition = await seedNode({
      type: 'composition',
      x: 900,
      y: 0,
      data: { layout: 'tilted-grid', layoutParams: {}, camera: { preset: 'static', params: {} }, background: { color: '#000000' }, duration: 6, aspect: '9:16', refId: null }
    });

    for (const [i, colour] of SWATCHES.entries()) {
      const png = await sharp({ create: { width: 480, height: 640, channels: 3, background: colour } }).png().toBuffer();
      const path = `${session.orgId}/${session.projectId}/${crypto.randomUUID()}.png`;
      expect((await admin.storage.from('canvas-assets').upload(path, png, { contentType: 'image/png' })).error).toBeNull();
      const asset = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'image', source: 'upload', url: path, mime_type: 'image/png' }).select('id').single();
      expect(asset.error).toBeNull();
      const image = await seedNode({ type: 'image', x: 0, y: i * 360, data: { refId: asset.data!.id } });
      const edge = await admin.from('nodes_connections').insert({ org_id: session.orgId, canvas_id: session.canvasId, source_node_id: image.id, target_node_id: composition.id, target_handle: 'images', actor_kind: 'user', actor_id: session.userId });
      expect(edge.error).toBeNull();
    }

    const crashes: string[] = [];
    page.on('pageerror', (error) => crashes.push(error.message));
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

    await page.getByTestId('pick-component').click();
    await page.getByTestId('component-search').fill('photo strip');
    await page.locator('[data-component="builtin:photo-strip"]').click();
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/1-library.png` });
    }
    await page.getByTestId('insert-component').click();

    await expect(page.getByTestId('composition-template')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('composition-fields')).toBeVisible();

    const loadedImages = async () => {
      let most = 0;
      for (const frame of page.frames().filter((f) => f.url() === PREVIEW_FRAME)) {
        const count = await frame.evaluate(() => new Set([...document.images].filter((img) => img.complete && img.naturalWidth > 0).map((img) => img.src)).size).catch(() => 0);
        most = Math.max(most, count);
      }
      return most;
    };
    await expect.poll(loadedImages, { timeout: 20_000 }).toBeGreaterThanOrEqual(SWATCHES.length);

    const saved = await admin.from('nodes').select('data').eq('id', composition.id).single();
    expect(saved.data?.data).toMatchObject({ template: { id: 'builtin:photo-strip' } });
    if (SHOTS) {
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SHOTS}/2-canvas.png` });
    }

    await page.getByRole('button', { name: 'Open editor' }).click();
    await expect(page).toHaveURL(/\/motion\//, { timeout: 20_000 });
    if (SHOTS) {
      await page.waitForTimeout(4000);
      await page.screenshot({ path: `${SHOTS}/3-motion-editor.png` });
    }
    expect(crashes).toEqual([]);
  });
});
