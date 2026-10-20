import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Locator, Page } from '@playwright/test';
import motion from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PHONE = { width: 390, height: 844 };
const MIN_TARGET_PX = 44;
const PEEK_PX = 160;
const SHOTS = process.env.PHONE_SHEET_SHOTS;

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

async function dragGrabber(page: Page, grabber: Locator, toY: number) {
  const box = (await grabber.boundingBox())!;
  const x = box.x + box.width / 2;
  await page.mouse.move(x, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, (box.y + toY) / 2, { steps: 4 });
  await page.mouse.move(x, toY, { steps: 4 });
  await page.mouse.up();
}

const heightOf = async (sheet: Locator) => (await sheet.boundingBox())!.height;

test.use({ actionTimeout: 15_000, video: 'off' });

test.describe('on a phone, Insert, Layers, Properties and Chat are bottom sheets @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack reale: E2E_REAL_STACK=1');

  test('insert from the + sheet, pick a layer, edit the last property at full height, back to peek', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(240_000);
    await page.setViewportSize(PHONE);
    const frame = await seedNode({ type: 'motion', x: 20, y: 60, data: LANDSCAPE });
    await admin.from('nodes').update({ display_name: 'Hero' }).eq('id', frame.id);
    await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: frame.id, version: 1, doc: motion, actor_kind: 'user', actor_id: session.userId });
    const nodeCount = async () => (await admin.from('nodes').select('id', { count: 'exact', head: true }).eq('canvas_id', session.canvasId).is('deleted_at', null)).count ?? 0;

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await expect(page.getByTestId('add-bar'), 'the wide add bar gives way to a single + on a phone').toBeHidden();

    const insert = page.getByTestId('insert-sheet');
    await page.getByTestId('mobile-view-insert').click();
    await expect(insert).toBeVisible();
    for (const tile of await insert.locator('[data-insert]').all()) {
      expect((await tile.boundingBox())!.height, 'an insert tile is a big touch target').toBeGreaterThanOrEqual(MIN_TARGET_PX);
    }
    await shoot(page, '1-canvas-insert');
    const before = await nodeCount();
    await insert.locator('[data-insert="text"]').click();
    await expect(insert, 'inserting closes the sheet').toBeHidden();
    await expect.poll(nodeCount, { timeout: 15_000, message: 'the tile inserts a node, as on desktop' }).toBe(before + 1);

    const layers = page.getByTestId('mobile-layers');
    await page.getByTestId('mobile-view-layers').click();
    await expect(layers).toBeVisible();
    const hero = layers.locator(`[data-layer="${frame.id}"]`);
    await expect(hero).toBeVisible({ timeout: 15_000 });
    expect((await hero.boundingBox())!.height, 'a layer row is a touch target').toBeGreaterThanOrEqual(MIN_TARGET_PX);
    await expect(async () => {
      await hero.click();
      await expect(hero, 'a tapped layer row selects its node').toHaveAttribute('aria-selected', 'true', { timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
    await shoot(page, '2-canvas-layers');

    await page.getByTestId('mobile-view-properties').click();
    const props = page.locator('aside.props');
    await expect(props).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('phone-tab-layers').click();
    const editorLayers = page.locator('aside.layers-sheet');
    await expect(editorLayers, 'the frame has its own Layers tab').toBeVisible();
    const clip = editorLayers.locator('[data-kind="clip"]').first();
    await expect(clip).toBeVisible({ timeout: 15_000 });
    await shoot(page, '3-frame-layers');
    await clip.click();
    await expect(props, 'picking a layer brings up its Properties').toBeVisible();
    await shoot(page, '4-frame-properties-peek');

    const grabber = props.getByTestId('sheet-grabber');
    await dragGrabber(page, grabber, 0);
    await expect.poll(() => heightOf(props), { message: 'dragged to the top, the sheet is full' }).toBeGreaterThan(PHONE.height * 0.6);
    const fields = props.locator('input[type="text"]:visible, input[type="number"]:visible');
    const last = fields.last();
    await last.scrollIntoViewIfNeeded();
    const sheetBox = (await props.boundingBox())!;
    const fieldBox = (await last.boundingBox())!;
    expect(fieldBox.y + fieldBox.height, 'the last field is inside the sheet, not clipped').toBeLessThanOrEqual(sheetBox.y + sheetBox.height + 1);
    expect(fieldBox.y + fieldBox.height, 'and inside the screen').toBeLessThanOrEqual(PHONE.height);
    await last.click();
    await expect(last).toBeFocused();
    await shoot(page, '5-frame-properties-full');

    await dragGrabber(page, props.getByTestId('sheet-grabber'), PHONE.height);
    await expect.poll(() => heightOf(props), { message: 'dragged down, the sheet rests at peek' }).toBeLessThanOrEqual(PEEK_PX + 1);
    await shoot(page, '6-frame-properties-peek');

    await page.getByTestId('phone-tab-insert').click();
    await expect(insert, 'the frame + opens the same insert sheet').toBeVisible();
    await expect(insert.locator('[data-insert="image"]')).toBeVisible();
    await expect(props, 'one sheet at a time').toBeHidden();
    await shoot(page, '7-frame-insert');
  });
});
