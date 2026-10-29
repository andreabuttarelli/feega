import { readFileSync } from 'node:fs';
import type { Locator, Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const nested = JSON.parse(readFileSync(new URL('./fixtures/nested-pick-doc.json', import.meta.url), 'utf8'));
const TEXT_AT = { x: 0.2, y: 0.5 };

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

async function pointIn(stage: Locator, share: { x: number; y: number }) {
  const box = (await stage.boundingBox())!;
  return { x: box.x + box.width * share.x, y: box.y + box.height * share.y };
}

async function hoverAt(page: Page, at: { x: number; y: number }, mods: 'ControlOrMeta' | null = null) {
  if (mods) {
    await page.keyboard.down(mods);
  }
  await page.mouse.move(at.x - 3, at.y);
  await page.mouse.move(at.x, at.y);
  const box = page.getByTestId('frame-pick-box');
  const id = (await box.count()) ? await box.getAttribute('data-hovered') : null;
  if (mods) {
    await page.keyboard.up(mods);
  }
  return id;
}

const selectedClip = async (page: Page) => {
  const marks = page.getByTestId('frame-selection');
  return (await marks.count()) ? await marks.first().getAttribute('data-clip') : null;
};

test.use({ video: SHOTS ? 'on' : 'off' });

test.describe('drill into a frame @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('hover is what a click selects, double-click descends one level, cmd reaches the deepest, Esc climbs, Layers in sync', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(150_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: nested.doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const sectionRow = page.getByTestId('layers').locator(`[data-layer="${nested.section}"]`);

    const stage = page.locator(`[data-testid="frame-overlays"] [data-frame="${node.id}"]`);
    await expect(stage).toBeVisible({ timeout: 20_000 });
    const overText = await pointIn(stage, TEXT_AT);

    await expect.poll(() => hoverAt(page, overText), { message: 'hover outlines the top-level child', timeout: 25_000 }).toBe(nested.section);
    await expect(sectionRow, 'hover on the canvas lights the Layers row').toHaveClass(/hovered/);
    expect(await hoverAt(page, overText, 'ControlOrMeta'), 'cmd reaches the deepest element').toBe(nested.text);
    await shoot(page, 'drill-1-hover');

    await page.mouse.click(overText.x, overText.y);
    await expect.poll(() => selectedClip(page), { message: 'one click selects what the hover outlined' }).toBe(nested.section);
    await expect(sectionRow).toHaveAttribute('aria-selected', 'true');
    await shoot(page, 'drill-2-click');

    await page.mouse.dblclick(overText.x, overText.y);
    await expect.poll(() => selectedClip(page), { message: 'double-click descends one level' }).toBe(nested.card);
    await shoot(page, 'drill-3-double-click');

    await page.keyboard.press('Escape');
    await expect.poll(() => selectedClip(page), { message: 'Esc climbs one level' }).toBe(nested.section);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('frame-selection'), 'Esc from the top-level child leaves the frame').toHaveCount(0);
    await shoot(page, 'drill-4-esc-up');

    await page.keyboard.down('ControlOrMeta');
    await page.mouse.click(overText.x, overText.y);
    await page.keyboard.up('ControlOrMeta');
    await expect.poll(() => selectedClip(page), { message: 'cmd-click selects the deepest element' }).toBe(nested.text);
    await shoot(page, 'drill-5-cmd-click');
  });
});
