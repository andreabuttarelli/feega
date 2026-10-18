import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated, type E2eSession } from './fixtures/session';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const PAINT_BUDGET_MS = 2000;
const COLUMNS = 5;
const STEP = { x: 460, y: 460 };
const FLAT_STDEV = 2;
const WARM_UP_MS = 25_000;

async function picture(admin: SupabaseClient, s: E2eSession): Promise<string> {
  const body = await sharp({ create: { width: 512, height: 512, channels: 3, background: '#2b6cb0' } }).composite([{ input: Buffer.from('<svg width="512" height="512"><circle cx="256" cy="256" r="160" fill="#f6ad55"/></svg>') }]).jpeg().toBuffer();
  const path = `${s.orgId}/${s.projectId}/${randomUUID()}.jpg`;
  expect((await admin.storage.from('canvas-assets').upload(path, body, { contentType: 'image/jpeg' })).error).toBeNull();
  return (await admin.from('assets').insert({ org_id: s.orgId, project_id: s.projectId, type: 'image', source: 'upload', url: path, mime_type: 'image/jpeg' }).select('id').single()).data!.id as string;
}

const KINDS = (img: string) => [
  { type: 'motion', data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null }, frame: true },
  { type: 'image', data: { prompt: '', assetId: img } },
  { type: 'text', data: { prompt: 'Write three hooks' } },
  { type: 'image', data: { prompt: 'A shoe', refId: img } },
  { type: 'doc', data: { content: '# Brief\n\nhello', public: false } }
];

test.describe('a cold GPU canvas paints every node at once @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('20 nodes: every node is painted within 2 s of the canvas appearing', async ({ page, session, admin }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    const img = await picture(admin, session);
    const kinds = KINDS(img);
    const rows = Array.from({ length: 20 }, (_, i) => {
      const k = kinds[i % kinds.length];
      return { id: randomUUID(), org_id: session.orgId, project_id: session.projectId, canvas_id: session.canvasId, type: k.type, x: (i % COLUMNS) * STEP.x, y: Math.floor(i / COLUMNS) * STEP.y, data: k.data, actor_kind: 'user', actor_id: session.userId };
    });
    expect((await admin.from('nodes').insert(rows)).error).toBeNull();
    for (const r of rows.filter((r) => r.type === 'motion')) {
      expect((await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: r.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId })).error).toBeNull();
    }

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.getByTestId('gpu-canvas')).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(PAINT_BUDGET_MS);

    const blank: string[] = [];
    for (const r of rows) {
      const box = await page.locator(`.svelte-flow__node[data-id="${r.id}"]`).boundingBox();
      if (!box || box.width < 8 || box.height < 8) {
        continue;
      }
      const pane = (await page.locator('[data-canvas-surface]').boundingBox())!;
      const x = Math.max(pane.x, box.x + 2);
      const y = Math.max(pane.y, box.y + 2);
      const w = Math.min(pane.x + pane.width, box.x + box.width - 2) - x;
      const h = Math.min(pane.y + pane.height, box.y + box.height - 2) - y;
      if (w < 8 || h < 8) {
        continue;
      }
      const stats = await sharp(await page.screenshot({ clip: { x, y, width: w, height: h } })).stats();
      if (stats.channels.every((c) => c.stdev < FLAT_STDEV)) {
        blank.push(`${r.type}:${r.id.slice(0, 6)}`);
      }
    }
    await page.screenshot({ path: test.info().outputPath('cold.png') });
    expect(blank, 'nodes still blank 2 s after the canvas appeared').toEqual([]);
  });

  test('the copy of a real heavy canvas paints every visible node within 2 s on a revisit, as the DOM canvas does', async ({ page }) => {
    test.setTimeout(180_000);
    test.skip(!process.env.GPU_FIXTURE_CANVAS, 'GPU_FIXTURE_PROJECT + GPU_FIXTURE_CANVAS: a copy made by copy-canvas.mjs in the test org');
    await page.setViewportSize({ width: 1600, height: 1000 });
    const logs: string[] = [];
    page.on('console', (m) => m.text().startsWith('[canvas]') && logs.push(m.text()));
    const blankOn = async (renderer: string) => {
      await gotoHydrated(page, `/p/${process.env.GPU_FIXTURE_PROJECT}/c/${process.env.GPU_FIXTURE_CANVAS}?renderer=${renderer}`);
      await expect(page.locator('.svelte-flow__node').first()).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(PAINT_BUDGET_MS);
      const pane = (await page.locator('.svelte-flow').first().boundingBox())!;
      const ids = await page.locator('.svelte-flow__node').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')!));
      const blank: string[] = [];
      for (const id of ids) {
        const box = await page.locator(`.svelte-flow__node[data-id="${id}"]`).boundingBox();
        if (!box) {
          continue;
        }
        const x = Math.max(pane.x, box.x + 2);
        const y = Math.max(pane.y, box.y + 2);
        const w = Math.min(pane.x + pane.width, box.x + box.width - 2) - x;
        const h = Math.min(pane.y + pane.height, box.y + box.height - 2) - y;
        if (w < 12 || h < 12) {
          continue;
        }
        const stats = await sharp(await page.screenshot({ clip: { x, y, width: w, height: h } })).stats();
        if (stats.channels.every((c) => c.stdev < FLAT_STDEV)) {
          blank.push(id);
        }
      }
      await page.screenshot({ path: test.info().outputPath(`real-copy-${renderer}.png`) });
      return blank;
    };
    const dom = await blankOn('dom');
    const cold = await blankOn('webgpu');
    await page.waitForTimeout(WARM_UP_MS);
    const warm = await blankOn('webgpu');
    console.log(`[cold-real] dom=${dom.length} gpu-cold=${cold.length} gpu-warm=${warm.length} logs=${JSON.stringify(logs.slice(0, 3))}`);
    expect(warm.filter((id) => !dom.includes(id)), 'on a revisit, nodes blank on the GPU canvas but painted on the DOM one').toEqual([]);
  });
});
