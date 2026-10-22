import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHOTS = process.env.SHOT_PREFIX ?? '';
const SETTLE_MS = 2500;
const SAVED_MS = 20_000;
const UNION_SPAN = 0.3;
const TURN = 30;
const SIDE_RIGHT = 7;
const shape = (id: string, x: number, color: string) => ({ id, from: 0, durationInFrames: 150, component: 'Shape', props: { shape: 'rect', x, y: 0.5, width: 0.2, height: 0.3, fills: [{ type: 'solid', color }] } });
const doc = {
  version: 5,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 150,
  background: 'brand',
  tracks: [
    { id: 'v1', kind: 'visual', name: 'Video 1', clips: [shape('a', 0.3, '#ff5a1f')] },
    { id: 'v2', kind: 'visual', name: 'Video 2', clips: [shape('b', 0.4, '#1f5aff')] }
  ],
  comps: {},
  assets: []
};

async function shot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}-${name}.png` });
  }
}

test.describe('group, boolean ops and deep select inside a core frame @real', () => {
  test.skip(!REAL_STACK, 'needs E2E_REAL_STACK=1');

  test('cmd-G groups, cmd-shift-G ungroups, the menu unites, cmd-click deep selects', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    const latest = async () => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single();
      return data?.doc as typeof doc;
    };
    const topIds = async () => (await latest()).tracks.flatMap((t) => t.clips.map((c) => c.id)).sort();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frame = page.locator(`[data-frame="${node.id}"]`);
    await page.waitForTimeout(SETTLE_MS);
    const at = async (x: number) => {
      const r = (await frame.boundingBox())!;
      return { x: r.x + r.width * x, y: r.y + r.height / 2 };
    };
    const left = await at(0.25);
    const right = await at(0.45);
    const selections = page.getByTestId('frame-selection');

    await page.mouse.click(left.x, left.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(left.x, left.y);
    await expect(selections).toHaveCount(1, { timeout: 15_000 });
    await page.keyboard.down('Shift');
    await page.mouse.click(right.x, right.y);
    await page.keyboard.up('Shift');
    await expect(selections).toHaveCount(2);
    await shot(page, 'picked');
    await expect(page.getByTestId('clip-bar').getByRole('button', { name: /^Union/ })).toBeAttached();

    await page.keyboard.press('ControlOrMeta+g');
    await expect(selections).toHaveCount(1);
    await expect.poll(async () => (await topIds()).length, { timeout: SAVED_MS }).toBe(1);
    await shot(page, 'grouped');

    const [group] = await topIds();
    await page.keyboard.down('ControlOrMeta');
    await page.mouse.click(left.x, left.y);
    await page.keyboard.up('ControlOrMeta');
    await expect(selections).toHaveAttribute('data-clip', `${group}__0__a`);
    await shot(page, 'deep');

    await page.keyboard.press('Escape');
    await expect(selections).toHaveAttribute('data-clip', group);
    await page.mouse.dblclick(left.x, left.y);
    await expect(selections).toHaveAttribute('data-clip', `${group}__0__a`);
    await shot(page, 'entered');
    await page.keyboard.press('Escape');
    await expect(selections).toHaveAttribute('data-clip', group);

    await page.mouse.click(left.x, left.y);
    await page.keyboard.press('ControlOrMeta+Shift+g');
    await expect(selections).toHaveCount(2);
    await expect.poll(topIds, { timeout: SAVED_MS }).toEqual(['a', 'b']);
    await shot(page, 'ungrouped');

    await page.mouse.click(left.x, left.y, { button: 'right' });
    const menu = page.getByTestId('canvas-menu');
    await expect(menu.getByText('Union')).toBeVisible();
    await shot(page, 'menu');
    await menu.getByText('Union').click();
    await expect(selections).toHaveCount(1);
    await expect.poll(async () => (await topIds()).length, { timeout: SAVED_MS }).toBe(1);
    const united = (await selections.boundingBox())!;
    const stage = (await frame.boundingBox())!;
    expect(united.width / stage.width).toBeCloseTo(UNION_SPAN, 1);
    await shot(page, 'united');
  });

  test('a rotated element is selected with a box that turns with it', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 200, y: 150, data: { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null } });
    const turned = { ...doc, tracks: [{ ...doc.tracks[0], clips: [{ ...shape('a', 0.5, '#ff5a1f'), transform: { rotateZ: TURN } }] }] };
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: turned, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const frame = page.locator(`[data-frame="${node.id}"]`);
    await page.waitForTimeout(SETTLE_MS);
    const r = (await frame.boundingBox())!;
    const centre = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    await page.mouse.click(centre.x, centre.y);
    await page.waitForTimeout(SETTLE_MS);
    await page.mouse.click(centre.x, centre.y);

    const selection = page.getByTestId('frame-selection');
    await expect(selection).toHaveCount(1, { timeout: 15_000 });
    await expect(selection).toHaveAttribute('style', new RegExp(`rotate\\(${TURN}deg\\)`));
    await shot(page, 'rotated');

    const widthOf = async () => Number((await selection.getAttribute('style'))?.match(/width:\s*([\d.]+)px/)?.[1]);
    const before = await widthOf();
    await page.keyboard.down('Alt');
    const handle = page.getByTestId('frame-selection-handle').nth(SIDE_RIGHT);
    const h = (await handle.boundingBox())!;
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(h.x + h.width / 2 + 30, h.y + h.height / 2 + 30 * Math.tan((TURN * Math.PI) / 180), { steps: 10 });
    await page.mouse.up();
    await page.keyboard.up('Alt');
    await expect(selection).toHaveAttribute('style', new RegExp(`rotate\\(${TURN}deg\\)`));
    expect(await widthOf(), 'Alt-resize grows the element along its own side').toBeGreaterThan(before);
    await shot(page, 'rotated-alt-resized');
  });
});
