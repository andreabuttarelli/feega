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

test.describe('groups that hold frames, and turn @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('a box and a frame group; the group rotates, the angles survive a reload, and the frame still opens after a move', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const frame = await seedNode({ type: 'motion', x: 360, y: 160, data: LANDSCAPE });
    await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: blank, actor_kind: 'user', actor_id: session.userId });
    const box = await seedNode({ type: 'motion', x: 120, y: 160, data: { ...LANDSCAPE, kind: 'element' } });
    await admin.from('nodes').update({ width: 120, height: 120 }).eq('id', box.id);
    await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: box.id, version: 1, doc: sheet, actor_kind: 'user', actor_id: session.userId });
    const rowOf = async (id: string) => (await admin.from('nodes').select('x, y, data').eq('id', id).single()).data!;

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('ControlOrMeta+g');
    await expect.poll(async () => (await rowOf(frame.id)).data.groupId, { timeout: 10_000 }).toBeTruthy();
    const groupId = String((await rowOf(frame.id)).data.groupId);
    await shoot(page, '0-grouped');

    await page.locator('.svelte-flow__pane').click({ position: { x: 10, y: 10 } });
    await page.locator(`.svelte-flow__node[data-id="${groupId}"]`).click({ position: { x: 4, y: 4 } });
    const handle = page.getByTestId('rotate-handle');
    await expect(handle).toBeVisible();
    const tile = (await page.locator(`.svelte-flow__node[data-id="${groupId}"]`).boundingBox())!;
    const from = (await handle.boundingBox())!;
    await page.mouse.move(from.x + 6, from.y + 6);
    await page.mouse.down();
    await page.mouse.move(tile.x + tile.width + 80, from.y + 6 + (tile.y + tile.height / 2 - from.y - 6), { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => Math.round(Number((await rowOf(groupId)).data.rotation)), { timeout: 10_000 }).toBe(90);
    const angle = Number((await rowOf(groupId)).data.rotation);
    expect(Number((await rowOf(frame.id)).data.rotation)).toBeCloseTo(angle, 5);
    await shoot(page, '1-rotated');

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect.poll(async () => Math.round(parseFloat(await page.locator(`.svelte-flow__node[data-id="${frame.id}"]`).evaluate((n) => getComputedStyle(n).rotate))), { timeout: 15_000 }).toBe(90);

    const before = await rowOf(frame.id);
    const turned = (await page.locator(`.svelte-flow__node[data-id="${groupId}"]`).boundingBox())!;
    const grab = await page.evaluate(([id, box]) => {
      for (let fy = 0.05; fy < 1; fy += 0.05) {
        for (let fx = 0.05; fx < 1; fx += 0.05) {
          const p = { x: box.x + box.width * fx, y: box.y + box.height * fy };
          if (document.elementFromPoint(p.x, p.y)?.closest('.svelte-flow__node')?.getAttribute('data-id') === id) {
            return p;
          }
        }
      }
      return null;
    }, [groupId, turned] as const);
    await shoot(page, '1b-reloaded');
    expect(grab, 'some of the group shows outside its frame, to grab it by').not.toBeNull();
    await page.mouse.move(grab!.x, grab!.y);
    await page.mouse.down();
    await page.mouse.move(grab!.x + 60, grab!.y + 80, { steps: 10 });
    await page.mouse.up();
    await expect.poll(async () => (await rowOf(frame.id)).x, { timeout: 10_000 }).not.toBe(before.x);

    await page.keyboard.press('Escape');
    await page.mouse.click(60, 600);
    const stage = (await page.locator(`[data-motion-node="${frame.id}"] [data-frame-stage]`).boundingBox())!;
    await page.mouse.click(stage.x + stage.width / 2, stage.y + stage.height / 2);
    await expect(page.getByTestId('motion-editor'), 'a frame inside a group still opens').toBeVisible({ timeout: 15_000 });
    await shoot(page, '2-frame-opens');
  });
});
