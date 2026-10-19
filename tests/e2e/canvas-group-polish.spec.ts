import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';

const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const blank = { version: 5, fps: 30, width: 1920, height: 1080, durationInFrames: 150, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [] }], comps: {}, assets: [] };
const sheet = { ...blank, width: 200, height: 200, background: 'transparent', still: { frame: 0 }, tracks: [{ id: 'v1', kind: 'visual', name: 'Video 1', clips: [{ id: 's', from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1 } }] }] };

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

test.use({ video: process.env.E2E_VIDEO ? 'on' : 'off' });

test.describe('groups behave like design-tool groups @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('undo a turn, members follow a drag live, a click on a member picks it, a resize scales it, previews show at once', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 420, y: 160, data: LANDSCAPE });
    await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: blank, actor_kind: 'user', actor_id: session.userId });
    const box = await seedNode({ type: 'motion', x: 120, y: 160, data: { ...LANDSCAPE, kind: 'element' } });
    await admin.from('nodes').update({ width: 120, height: 120 }).eq('id', box.id);
    await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: box.id, version: 1, doc: sheet, actor_kind: 'user', actor_id: session.userId });
    const rowOf = async (id: string) => (await admin.from('nodes').select('x, y, width, height, data').eq('id', id).single()).data!;

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.locator(`[data-motion-node="${box.id}"]`).locator('iframe, [data-testid="motion-node-poster"]').first(), 'an element with no poster yet shows its picture, not an empty outline').toBeVisible({ timeout: 15_000 });
    await expect(page.locator(`[data-motion-node="${box.id}"] [data-testid="element-placeholder"]`)).toHaveCount(0);
    await shoot(page, '1-live-preview');

    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+g');
    await expect.poll(async () => (await rowOf(frame.id)).data.groupId, { timeout: 10_000 }).toBeTruthy();
    const groupId = String((await rowOf(frame.id)).data.groupId);
    await expect(page.locator(`.svelte-flow__node[data-id="${box.id}"]`), 'the box now lives inside the group the server wrote').toHaveCount(0);
    const groupTile = page.locator(`.svelte-flow__node[data-id="${groupId}"]`);
    const frameTile = page.locator(`.svelte-flow__node[data-id="${frame.id}"]`);

    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    const g = (await groupTile.boundingBox())!;
    await page.mouse.click(g.x + 60, g.y + 60);
    await expect(groupTile).toHaveClass(/selected/);
    const f = (await frameTile.boundingBox())!;
    await page.mouse.click(f.x + f.width / 2, f.y + 20);
    await expect(frameTile, 'a click on a member of the selected group picks the member').toHaveClass(/selected/);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    await page.mouse.click(g.x + 60, g.y + 60);
    const frameBefore = (await frameTile.boundingBox())!;
    await page.mouse.move(g.x + 60, g.y + 60);
    await page.mouse.down();
    await page.mouse.move(g.x + 100, g.y + 140, { steps: 8 });
    const frameMid = (await frameTile.boundingBox())!;
    expect(frameMid.y - frameBefore.y, 'the frame follows the group while it is dragged').toBeGreaterThan(40);
    await shoot(page, '2-live-follow');
    await page.mouse.up();
    await expect.poll(async () => (await rowOf(frame.id)).y, { timeout: 10_000 }).toBeGreaterThan(200);

    const handle = page.getByTestId('rotate-handle');
    await expect(handle).toBeVisible();
    const h = (await handle.boundingBox())!;
    const tile = (await groupTile.boundingBox())!;
    await page.mouse.move(h.x + 6, h.y + 6);
    await page.mouse.down();
    await page.mouse.move(tile.x + tile.width + 80, tile.y + tile.height / 2, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => Math.abs(Number((await rowOf(groupId)).data.rotation ?? 0)), { timeout: 10_000 }).toBeGreaterThan(10);
    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('ControlOrMeta+z');
    await expect.poll(async () => Math.round(Number((await rowOf(groupId)).data.rotation ?? 0)), { timeout: 10_000 }).toBe(0);
    expect(Math.round(Number((await rowOf(frame.id)).data.rotation ?? 0)), 'the undo turns the frame back too').toBe(0);
    await shoot(page, '3-turn-undone');

    const widthBefore = Number((await rowOf(frame.id)).width);
    await page.evaluate(([id]) => {
      const el = document.querySelector(`.svelte-flow__node[data-id="${id}"]`) as HTMLElement;
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }, [groupId]);
    const resizer = page.locator(`.svelte-flow__node[data-id="${groupId}"] .svelte-flow__resize-control.bottom.right`).first();
    const r = (await resizer.boundingBox())!;
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
    await page.mouse.down();
    await page.mouse.move(r.x + 200, r.y + 100, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => Number((await rowOf(frame.id)).width), { timeout: 10_000 }).toBeGreaterThan(widthBefore + 20);
    await shoot(page, '4-scaled');
  });
});
