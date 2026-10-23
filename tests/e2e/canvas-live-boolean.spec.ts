import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { SHOTS_DIR } from './fixtures/shots';

const SETTLE_MS = 2500;
const NUDGES = 6;

const rect = (id: string, x: number, color: string) => ({
  id,
  from: 0,
  durationInFrames: 150,
  component: 'Shape',
  props: { shape: 'rect', x, y: 0.5, width: 0.3, height: 0.4, fills: [{ type: 'solid', color }], fill: color }
});

const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [
    { id: 'v1', kind: 'visual', name: 'Video 1', clips: [rect('a', 0.35, '#ff5a1f')] },
    { id: 'v2', kind: 'visual', name: 'Video 2', clips: [rect('b', 0.55, '#1f5aff')] }
  ],
  comps: {} as Record<string, { tracks: { clips: Clip[] }[] }>,
  assets: []
};

type Clip = { id: string; component: string; props: Record<string, unknown> };

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${SHOTS_DIR}/vec-live-boolean-${name}.png` });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('feega.frame-edit-mode', 'design'));
});

test.describe('live boolean group @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('union keeps the children, redraws on change, flatten bakes', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null, rotation: 0 } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frame = page.locator(`[data-frame="${node.id}"]`);
    await page.waitForTimeout(SETTLE_MS);
    const box = (await frame.boundingBox())!;
    const at = (u: number, v: number) => ({ x: box.x + box.width * u, y: box.y + box.height * v });
    const latest = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single();
      return data!.doc as typeof doc;
    };
    const topClips = async () => (await latest()).tracks.flatMap((t) => t.clips as unknown as Clip[]);

    const onlyA = at(0.25, 0.5);
    const onlyB = at(0.65, 0.5);
    await page.mouse.click(onlyA.x, onlyA.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(onlyA.x, onlyA.y);
    await expect(page.getByTestId('frame-selection')).toHaveCount(1, { timeout: 15_000 });
    await page.keyboard.down('Shift');
    await page.mouse.click(onlyB.x, onlyB.y);
    await page.keyboard.up('Shift');
    await expect(page.getByTestId('frame-selection')).toHaveCount(2, { timeout: 15_000 });

    await page.keyboard.press('Alt+Shift+U');
    await expect.poll(async () => (await topClips()).some((c) => c.component === 'Precomp' && c.props.boolean === 'union'), { timeout: 30_000 }).toBe(true);
    const saved = await latest();
    const inner = Object.values(saved.comps).flatMap((c) => c.tracks.flatMap((t) => t.clips));
    expect(inner.map((c) => c.id).sort()).toEqual(['a', 'b']);
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'union');

    await page.mouse.dblclick(onlyB.x, onlyB.y);
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'inside');
    for (let i = 0; i < NUDGES; i++) {
      await page.keyboard.press('Shift+ArrowRight');
    }
    const childB = async () => Object.values((await latest()).comps).flatMap((c) => c.tracks.flatMap((t) => t.clips)).find((c) => c.id === 'b');
    await expect.poll(async () => JSON.stringify(await childB()) !== JSON.stringify(rect('b', 0.55, '#1f5aff')), { timeout: 30_000 }).toBe(true);
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'moved-child');

    await page.getByText('Group 1', { exact: false }).first().click();
    await page.keyboard.press('ControlOrMeta+E');
    await expect.poll(async () => (await topClips()).some((c) => c.component === 'Shape' && c.props.shape === 'path'), { timeout: 30_000 }).toBe(true);
    expect((await topClips()).some((c) => c.component === 'Precomp')).toBe(false);
    await page.waitForTimeout(SETTLE_MS);
    await shot(page, 'flattened');
  });
});
