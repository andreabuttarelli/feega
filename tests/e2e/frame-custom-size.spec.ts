import sharp from 'sharp';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import { drawnElement } from '../../src/lib/motion/draw-create';
import { DrawTool } from '../../src/lib/motion/draw-tool';
import { setCanvas } from '../../src/lib/motion/timeline';
import { Background, MotionFormat, type MotionDoc } from '../../src/lib/motion/doc';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.FRAME_CUSTOM_SHOTS;
const DRAG = { x: -140, y: 160 };
const ASPECT_TOLERANCE = 0.03;
const EDGE_INSET = 3;
const REALTIME_SETTLE_MS = 2000;
const COLOUR_TOLERANCE = 40;

test.use({ video: SHOTS ? 'on' : 'off', viewport: { width: 1600, height: 1000 } });

function filledLandscape(): MotionDoc {
  const drawn = drawnElement({ tool: DrawTool.Rectangle, box: { left: 0, top: 0, width: 960, height: 540 } }, 'fill');
  if (!drawn.ok) {
    throw new Error(drawn.error);
  }
  const sized = setCanvas(drawn.doc, { format: MotionFormat.Landscape, background: Background.Brand });
  if (!sized.ok) {
    throw new Error(sized.error);
  }
  return { ...sized.doc, tracks: sized.doc.tracks.map((t) => ({ ...t, locked: true})) };
}

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

async function edgesMatchCentre(page: Page): Promise<{ centre: number[]; edges: number[][] }> {
  const png = await page.getByTestId('motion-node-stage').screenshot();
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  const at = (x: number, y: number) => {
    const i = (Math.round(y) * info.width + Math.round(x)) * info.channels;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const { width: w, height: h } = info;
  return { centre: at(w / 2, h / 2), edges: [at(EDGE_INSET, h / 2), at(w - EDGE_INSET, h / 2), at(w / 2, EDGE_INSET), at(w / 2, h - EDGE_INSET)] };
}

test.describe('a custom frame takes the size of its node @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('pick Custom, resize the node: the doc follows its aspect, no bands, saved', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: filledLandscape(), actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(async () => {
      const tile = (await page.locator(`.svelte-flow__node[data-id="${node.id}"]`).boundingBox())!;
      await page.mouse.click(tile.x + 24, tile.y - 10);
      await expect(page.getByRole('tab', { name: 'Properties' })).toBeVisible({ timeout: 3000 });
    }, 'the frame opens in place').toPass({ timeout: 30_000 });
    await page.getByRole('tab', { name: 'Properties' }).click();
    const settings = page.getByTestId('composition-settings');
    await shoot(page, '0-frame-selected');
    await expect(settings).toBeVisible({ timeout: 20_000 });
    await settings.locator('select').first().selectOption(MotionFormat.Custom);
    await shoot(page, '1-custom-picked');

    await expect(page.getByRole('status', { name: /Saved · v2/ }), 'picking Custom is saved').toBeVisible({ timeout: 15_000 });
    await expect(async () => {
      const row = await admin.from('nodes').select('data').eq('id', node.id).single();
      expect((row.data!.data as { format: string }).format).toBe(MotionFormat.Custom);
    }, 'the frame node is marked custom').toPass({ timeout: 15_000 });
    await page.waitForTimeout(REALTIME_SETTLE_MS);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Properties' })).toBeHidden({ timeout: 10_000 });
    await page.locator('.node-label').first().click();
    await expect(page.getByRole('status', { name: /Saved · v2/ }), 'the frame is open again').toBeVisible({ timeout: 15_000 });
    await shoot(page, '1b-node-selected');
    const handle = page.locator('.svelte-flow__resize-control.handle.bottom.left').first();
    await expect(handle).toBeVisible({ timeout: 10_000 });
    const from = (await handle.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + DRAG.x, from.y + DRAG.y, { steps: 12 });
    await page.mouse.up();
    await shoot(page, '2-resized');

    const stage = page.getByTestId('motion-node-stage');
    let saved: MotionDoc | null = null;
    await expect(async () => {
      const box = (await stage.boundingBox())!;
      const head = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1).single();
      saved = head.data!.doc as MotionDoc;
      expect(saved.freeSize).toBe(true);
      expect(saved.width / saved.height, 'the drag made the frame taller than 16:9').toBeLessThan(16 / 9 - 0.2);
      expect(Math.abs(saved.width / saved.height - box.width / box.height)).toBeLessThan(ASPECT_TOLERANCE);
    }, 'the saved doc takes the node aspect').toPass({ timeout: 20_000 });

    await page.keyboard.press('Escape');
    await page.locator('.svelte-flow__pane').click({ position: { x: 5, y: 5 } });
    await page.waitForTimeout(1500);
    await shoot(page, '2b-closed');
    await expect(async () => {
      const { centre, edges } = await edgesMatchCentre(page);
      for (const edge of edges) {
        expect(Math.max(...edge.map((c, i) => Math.abs(c - centre[i]))), `edge ${edge} vs centre ${centre}`).toBeLessThan(COLOUR_TOLERANCE);
      }
    }, 'the composition fills the node to its edges').toPass({ timeout: 30_000 });
    await shoot(page, '3-no-bands');

    await page.reload();
    await expect(page.getByTestId('motion-node-stage')).toBeVisible({ timeout: 20_000 });
    const after = (await page.getByTestId('motion-node-stage').boundingBox())!;
    expect(Math.abs(saved!.width / saved!.height - after.width / after.height), 'reloaded, the node keeps the custom shape').toBeLessThan(ASPECT_TOLERANCE);
    await shoot(page, '4-reloaded');
  });
});
