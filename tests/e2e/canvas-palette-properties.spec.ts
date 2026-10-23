import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { SupabaseClient } from '@supabase/supabase-js';

const SHOTS = process.env.CANVAS_P2B_SHOTS ?? '/tmp';
const SETTLE_MS = 2500;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const RED = '#ff2d55';
const GREEN = '#30d158';
const SHADOW = { id: 'sh', kind: 'drop-shadow', enabled: true, params: { distance: 0, x: 30, y: 40, blur: 20, spread: 24, opacity: 0.75, behind: 0 } };

type Clip = { id: string; props: Record<string, unknown>; effects?: unknown[] };
type Doc = { tracks: { clips: Clip[] }[] };

const shape = (id: string, x: number, props: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  id,
  from: 0,
  durationInFrames: 150,
  component: 'Text',
  ...extra,
  props: { text: id, size: 0.12, x, y: 0.5, width: 0.3, height: 0.25, ...props }
});

const frameDoc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  still: { frame: 0 },
  tracks: [
    {
      id: 'v1',
      kind: 'visual',
      name: 'Video 1',
      clips: [
        shape('styled', 0.25, { fills: [{ type: 'solid', color: RED }], strokes: [{ paint: { type: 'solid', color: GREEN }, width: 0.02 }] }, { effects: [SHADOW] }),
        shape('plain', 0.7, { fills: [{ type: 'solid', color: '#0a84ff' }] })
      ]
    }
  ],
  comps: {},
  assets: []
};

async function clipOf(admin: SupabaseClient, nodeId: string, id: string): Promise<Clip | undefined> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  return (data?.[0]?.doc as Doc | undefined)?.tracks.flatMap((t) => t.clips).find((c) => c.id === id);
}

test.describe('palette and copy properties @real', () => {
  test.skip(!REAL_STACK, 'requires a stack: E2E_REAL_STACK=1');

  test('copy properties and paste properties move fill, stroke and effect; the palette selects the same fill', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: frameDoc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    const stage = (await page.locator(`[data-testid="frame-overlays"] [data-frame="${frame.id}"]`).boundingBox())!;
    const at = (x: number) => ({ x: stage.x + stage.width * x, y: stage.y + stage.height / 2 });

    await page.mouse.click(stage.x + 4, stage.y + 4);
    await page.waitForTimeout(SETTLE_MS);
    const toCanvasKeys = () => page.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    await page.locator('[data-layer="styled"]').first().click();
    await toCanvasKeys();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/p2b-copy-0-picked.png` });
    await page.keyboard.press('Alt+Meta+c');
    await page.locator('[data-layer="plain"]').first().click();
    await toCanvasKeys();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SHOTS}/p2b-copy-1-before-paste.png` });
    await page.keyboard.press('Alt+Meta+v');
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/p2b-copy-2-after-paste.png` });

    await expect.poll(async () => ((await clipOf(admin, frame.id, 'plain'))?.props.fills as { color: string }[] | undefined)?.map((f) => f.color), { timeout: 15_000 }).toEqual([RED]);
    const pasted = await clipOf(admin, frame.id, 'plain');
    expect(pasted?.props.strokes).toHaveLength(1);
    expect(pasted?.effects).toHaveLength(1);

    await page.keyboard.press('Meta+k');
    const palette = page.getByTestId('command-palette-input');
    await expect(palette).toBeVisible();
    await palette.fill('same fill');
    await page.screenshot({ path: `${SHOTS}/p2b-palette-1-same-fill.png` });
    await page.keyboard.press('Enter');
    await expect(palette).toHaveCount(0);
    await page.waitForTimeout(SETTLE_MS);
    await page.screenshot({ path: `${SHOTS}/p2b-palette-2-selected.png` });
  });
});
