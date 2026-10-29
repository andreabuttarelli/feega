import { mkdirSync } from 'node:fs';
import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SETTLE_MS = 2500;
const SHOTS = process.env.MODE_SWITCH_SHOTS;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const key = (frame: number, value: number) => ({ frame, value, ease: 'linear' });
const shape = (id: string, color: string, over: object = {}) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 0.16, height: 0.24, fills: [{ type: 'solid', color }] }, ...over });
const docOf = (clips: object[]) => ({
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: clips.map((clip, i) => ({ id: `t${i}`, kind: 'visual', name: `Video ${i + 1}`, clips: [clip] })),
  comps: {},
  assets: []
});

async function shoot(page: Page, name: string) {
  if (!SHOTS) {
    return;
  }
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: `${SHOTS}/motion2-${name}.png` });
}

test.describe('Motion mode tools @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('canvas drags key the playhead, paths and onion skin show, sound sits in the panel', async ({ page, session, admin, seedNode }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const slide = shape('slide', '#1f5aff', { keyframes: { x: [key(0, -0.3), key(75, 0), key(149, 0.3)], y: [key(0, 0.15), key(75, -0.15), key(149, 0.15)] } });
    const still = shape('still', '#ff6a3d', { props: { shape: 'rect', x: 0.2, y: 0.25, width: 0.12, height: 0.18, fills: [{ type: 'solid', color: '#ff6a3d' }] } });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: docOf([slide, still]), actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();
    const headDoc = async () => (await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single()).data.doc;
    const clipIn = (doc: any, id: string) => doc.tracks.flatMap((t: any) => t.clips).find((c: any) => c.id === id);

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.waitForTimeout(SETTLE_MS);
    await page.locator(`.svelte-flow__node[data-id="${node.id}"]`).getByTestId('motion-node-stage').dblclick({ position: { x: 20, y: 20 } });
    await page.getByTestId('editor-mode-switch').locator('[data-mode="motion"]').click();
    await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 15_000 });

    await page.locator('[data-layer="slide"] .head').click();
    const ruler = page.getByRole('slider', { name: 'Playhead' });
    const rail = (await ruler.boundingBox())!;
    await page.mouse.click(rail.x + rail.width * 0.3, rail.y + rail.height / 2);
    await expect(page.getByTestId('path-overlay')).toBeVisible();
    await shoot(page, 'path');

    await page.getByTestId('frame-timeline-onion').click();
    await expect(page.getByTestId('onion-skin').locator('path')).toHaveCount(2);
    await shoot(page, 'onion');

    await page.locator('[data-layer="still"] .head').click();
    const stage = (await page.locator(`[data-motion-node="${node.id}"] [data-frame-stage]`).boundingBox())!;
    const from = { x: stage.x + stage.width * 0.2, y: stage.y + stage.height * 0.25 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 160, from.y + 90, { steps: 6 });
    await page.mouse.up();
    await expect.poll(async () => clipIn(await headDoc(), 'still').keyframes?.x?.length ?? 0, { timeout: 15_000 }).toBe(2);
    await page.waitForTimeout(800);
    await shoot(page, 'drag-keyed');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('frame-sound-section')).toBeVisible();
    await shoot(page, 'sound');
    await page.getByTestId('frame-sound-music').click();
    await page.waitForTimeout(800);
    await shoot(page, 'music-dialog');
  });
});
