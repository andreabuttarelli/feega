import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const PORTRAIT = {
  format: '4:5',
  docHeadRevision: 1,
  posterAssetId: null,
  lastRenderAssetId: null
};
const SHOTS = process.env.CANVAS_MOTION_SHOTS;

type Clip = { id: string; clipContent?: boolean; transform?: { scaleX?: number }; props: { smoothing?: number } };
type Doc = { tracks: { clips: Clip[] }[] };

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

async function head(admin: SupabaseClient, nodeId: string): Promise<Doc | null> {
  const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', nodeId).order('version', { ascending: false }).limit(1);
  return (data?.[0]?.doc as Doc | undefined) ?? null;
}

const clipOf = (doc: Doc | null, id: string) => doc?.tracks.flatMap((t) => t.clips).find((c) => c.id === id);

function framedDoc() {
  const card = { id: 'card', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', roundness: 0.2, x: 0.5, y: 0.45, width: 0.6, height: 0.4, fills: [{ type: 'solid', color: '#ff5a1f' }] } };
  const kid = { id: 'kid', from: 0, durationInFrames: 150, component: 'Shape', parent: 'card', props: { shape: 'ellipse', x: 0.8, y: 0.3, width: 0.4, height: 0.3, fills: [{ type: 'solid', color: '#2b2bff' }] } };
  return {
    version: 5,
    fps: 30,
    width: 1080,
    height: 1350,
    durationInFrames: 150,
    still: { frame: 90 },
    tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [card, kid] }],
    comps: {},
    assets: []
  };
}

test.use({ video: SHOTS ? 'on' : 'off' });

test.describe('layer section @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('a frame clips its child, flips, and smooths its corners from Properties', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: framedDoc(), actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mode', 'still', { timeout: 15_000 });

    const overlay = page.getByTestId('selection-overlay');
    await expect(async () => {
      await overlay.click({ position: { x: 130, y: 200 } });
      await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: 1000 });
    }, 'the card selects once the preview has measured it').toPass({ timeout: 15_000 });
    await page.getByRole('tab', { name: 'Properties' }).click();
    const layer = page.getByTestId('motion-inspector').locator('[data-section="layer"]');
    await expect(layer.getByTestId('layer-look')).toBeVisible();

    await layer.locator('[data-segmented="Clip content"]').getByRole('radio', { name: 'Yes' }).click();
    await expect.poll(async () => clipOf(await head(admin, node.id), 'card')?.clipContent, { timeout: 10_000 }).toBe(true);

    await page.getByTestId('motion-inspector').getByTestId('flip-horizontal').click();
    await expect.poll(async () => clipOf(await head(admin, node.id), 'card')?.transform?.scaleX, { timeout: 10_000 }).toBe(-1);

    const smoothing = layer.locator('[data-prop="smoothing"] input');
    await smoothing.fill('60');
    await smoothing.press('Enter');
    await expect.poll(async () => clipOf(await head(admin, node.id), 'card')?.props.smoothing, { timeout: 10_000 }).toBeGreaterThan(0);
    await shoot(page, 'pr2-layer-section');
  });
});
