import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { SupabaseClient } from '@supabase/supabase-js';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const zero = { x: 0, y: 0 };
const line = (start: number, end: number) => ({ start, end, tangentStart: zero, tangentEnd: zero });
const network = { vertices: [{ x: 0, y: 0 }, { x: 0.5, y: 1 }, { x: 1, y: 0 }], segments: [line(0, 1), line(1, 2)], regions: [] };

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 'vec', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'vector', network, x: 0.5, y: 0.5, width: 0.4, height: 0.4, strokes: [{ paint: { type: 'solid', color: '#ff3366' }, width: 0.01 }] } }] }],
  comps: {},
  assets: []
};

type Net = typeof network;

async function head(admin: SupabaseClient, nodeId: string): Promise<Net | null> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  const saved = data?.[0]?.doc as typeof doc | undefined;
  return (saved?.tracks[0].clips[0].props.network as Net | undefined) ?? null;
}

test.describe('vector networks @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('a point drags, and the pen branches a new segment from the middle point', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator(`[data-motion-node="${frame.id}"] [data-frame-stage]`).first().click({ position: { x: 4, y: 4 } });
    const overlay = page.getByTestId('selection-overlay');
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    const stage = (await page.getByTestId('motion-preview').first().boundingBox())!;
    await page.mouse.dblclick(stage.x + stage.width * 0.4, stage.y + stage.height * 0.5);

    const vector = page.getByTestId('vector-overlay');
    await expect(vector).toBeVisible({ timeout: 10_000 });
    await expect(vector.locator('[data-vertex]')).toHaveCount(3);

    const middle = (await vector.locator('[data-vertex="1"]').boundingBox())!;
    await page.mouse.move(middle.x + middle.width / 2, middle.y + middle.height / 2);
    await page.mouse.down();
    await page.mouse.move(middle.x + middle.width / 2, middle.y - 40, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await head(admin, frame.id))?.vertices[1].y ?? 1, { timeout: 15_000 }).toBeLessThan(0.95);

    await page.getByTestId('vector-pen').click();
    await page.mouse.click(stage.x + stage.width * 0.5, stage.y + stage.height * 0.25);
    await expect.poll(async () => (await head(admin, frame.id))?.segments.length ?? 0, { timeout: 15_000 }).toBe(3);
    const saved = (await head(admin, frame.id))!;
    expect(saved.segments.filter((s) => s.start === 1 || s.end === 1)).toHaveLength(3);
  });
});
