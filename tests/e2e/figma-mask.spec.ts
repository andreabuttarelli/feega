import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import motion from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const [visual, audio] = motion.tracks;
const title = visual.clips[0];
const DISC = { ...title, id: 'disc', component: 'Shape', keyframes: {}, props: { shape: 'ellipse', x: 0.5, y: 0.5, width: 0.35, height: 0.6, fill: '#ffffff' } };
const STACKED = { ...motion, tracks: [{ ...visual, id: 'title-track', name: 'Video 2', clips: [{ ...title, id: 'word' }] }, { ...visual, id: 'disc-track', name: 'Video 1', clips: [DISC] }, audio] };

type Saved = { tracks: { clips: { id: string; matteFrom?: string | null }[] }[] };

test.describe('use a shape as mask @real', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!REAL_STACK, 'richiede uno stack: E2E_REAL_STACK=1');

  test('⌃⌘M masks the layer above with the shape, Layers nests it, Remove mask frees it', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: STACKED, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    const savedMask = async () => {
      const rows = (await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1)).data;
      const doc = rows?.[0]?.doc as Saved | undefined;
      return doc?.tracks.flatMap((t) => t.clips).find((c) => c.id === 'word')?.matteFrom ?? null;
    };

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByTestId('layers');
    await layers.locator(`[data-layer="${node.id}"]`).click();
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });

    await layers.locator('[data-layer="word"]').click();
    await layers.locator('[data-layer="disc"]').click({ modifiers: ['Shift'] });
    await page.keyboard.press('Control+Meta+m');

    const mask = layers.locator('[data-layer="disc"]');
    await expect(mask).toHaveAttribute('data-kind', 'mask');
    await expect(layers.locator('[data-layer="word"]')).toHaveAttribute('aria-level', '3');
    await expect.poll(savedMask, { timeout: 10_000 }).toBe('disc');
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/mask-on.png` });
    }

    await mask.click({ button: 'right' });
    await page.getByTestId('layer-menu').getByRole('menuitem', { name: /Remove mask/ }).click();

    await expect(mask).toHaveAttribute('data-kind', 'clip');
    await expect.poll(savedMask, { timeout: 10_000 }).toBeNull();
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/mask-removed.png` });
    }
  });
});
