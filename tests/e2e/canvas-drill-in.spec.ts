import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Locator, Page } from '@playwright/test';
import poster from './fixtures/poster-type-grid.json' with { type: 'json' };

const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const CLIP = 'poster';
const TITLE_PART = 'lines:0';
const TITLE = { x: 0.4, y: 0.1 };

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

async function at(target: Locator, share: { x: number; y: number }) {
  const box = (await target.boundingBox())!;
  return { x: box.width * share.x, y: box.height * share.y };
}

test.use({ video: SHOTS ? 'on' : 'off' });

test.describe('drill into a frame like Figma @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('hover a child of a closed frame, double-click down to a part, Esc back up, cmd-click deep, Layers in sync', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: poster, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByTestId('layers');
    const clipRow = layers.locator(`[data-layer="${CLIP}"]`);
    const partRow = layers.locator(`[data-layer="${CLIP}#${TITLE_PART}"]`);
    await expect(clipRow).toHaveCount(1, { timeout: 15_000 });

    const stage = page.getByTestId('motion-node-stage');
    const hoverBox = page.getByTestId('frame-hover-box');
    const title = await at(stage, TITLE);
    await expect(async () => {
      await stage.hover({ position: { x: title.x + 1, y: title.y } });
      await stage.hover({ position: title });
      await expect(hoverBox).toHaveAttribute('data-hovered', CLIP, { timeout: 1000 });
    }, 'a child of the closed frame outlines on hover').toPass({ timeout: 20_000 });
    await expect(clipRow, 'hover on the canvas lights the Layers row').toHaveClass(/hovered/);
    await expect(page.getByTestId('motion-editor'), 'hovering never opens the frame').toHaveCount(0);
    await shoot(page, 'drill-1-hover-closed-child');

    await stage.dblclick({ position: title });
    const overlay = page.getByTestId('selection-overlay');
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('selection-box'), 'double-click on a closed frame selects its child').toBeVisible({ timeout: 15_000 });
    await expect(clipRow).toHaveAttribute('aria-selected', 'true');
    await expect(clipRow).toBeInViewport();
    await shoot(page, 'drill-2-child');

    const inside = await at(overlay, TITLE);
    await overlay.dblclick({ position: inside });
    await expect(page.getByTestId('part-box'), 'the next double-click selects the part').toHaveAttribute('data-part', TITLE_PART);
    await expect(partRow).toHaveAttribute('aria-selected', 'true');
    await expect(partRow).toBeInViewport();
    await shoot(page, 'drill-3-part');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('part-box'), 'Esc climbs from the part to its clip').toHaveCount(0);
    await expect(page.getByTestId('selection-box')).toBeVisible();
    await expect(clipRow).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('selection-box'), 'Esc climbs from the clip to the frame').toHaveCount(0);
    await expect(page.getByTestId('motion-editor'), 'the frame stays open at frame level').toBeVisible();
    await shoot(page, 'drill-4-esc-up');

    await page.keyboard.press('Enter');
    await expect(page.getByTestId('selection-box'), 'Enter goes back down').toBeVisible();
    await page.keyboard.press('Shift+Enter');
    await expect(page.getByTestId('selection-box')).toHaveCount(0);

    await overlay.click({ position: inside, modifiers: ['ControlOrMeta'] });
    await expect(page.getByTestId('part-box'), 'cmd-click selects the innermost element').toHaveAttribute('data-part', TITLE_PART);
    await expect(partRow).toHaveAttribute('aria-selected', 'true');
    await shoot(page, 'drill-5-cmd-click');

    await overlay.hover({ position: { x: inside.x, y: inside.y * 4 } });
    await partRow.hover();
    await expect(page.getByTestId('layer-hover-part'), 'hover in Layers outlines on the canvas').toBeVisible();

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('motion-editor'), 'Esc at frame level closes the frame').toHaveCount(0);

    await stage.click({ position: title, modifiers: ['ControlOrMeta'] });
    await expect(page.getByTestId('part-box'), 'cmd-click on a closed frame opens it on the innermost element').toHaveAttribute('data-part', TITLE_PART, { timeout: 15_000 });
    await shoot(page, 'drill-6-cmd-click-closed');
  });
});
