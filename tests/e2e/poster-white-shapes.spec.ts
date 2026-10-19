import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import poster from './fixtures/poster-white-shapes.json' with { type: 'json' };

const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHAPE = 'shapes:5';
const PINK = '#ff00aa';
const PINK_RGB = 'rgb(255, 0, 170)';
const SHOTS = process.env.CANVAS_MOTION_SHOTS;

async function shapeFills(page: Page): Promise<string[]> {
  const fills = await Promise.all(
    page
      .frames()
      .filter((f) => f !== page.mainFrame())
      .map((frame) => frame.evaluate((id) => {
        const shape = document.querySelector(`[data-part="${id}"]`);
        return shape ? getComputedStyle(shape).fill : null;
      }, SHAPE).catch(() => null))
  );
  return fills.filter((f): f is string => !!f);
}

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

test.describe('poster white shapes @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack: E2E_REAL_STACK=1');

  test('a block is a shape layer; a new colour paints it in the editor, on the tile and after a reload', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(180_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: poster, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const tile = page.locator(`.svelte-flow__node[data-id="${node.id}"]`);
    await expect(tile).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(3000);
    const tileBefore = await tile.screenshot();

    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mode', 'still', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const row = page.getByTestId('layers').locator(`[data-layer="poster#${SHAPE}"]`);
    await expect(row).toContainText('Shape 6', { timeout: 15_000 });
    await expect(row.locator('svg.lucide-shapes'), 'a shape row, never a text row').toHaveCount(1);
    await expect(row.locator('svg.lucide-type')).toHaveCount(0);
    await row.click();
    await shoot(page, 'ws-1-shape-selected');

    const inspector = page.getByTestId('motion-inspector');
    await expect(page.getByTestId('part-text'), 'a shape has no text to edit').toHaveCount(0);
    await inspector.getByTestId('part-fill').getByTestId('fill-swatch').click();
    const hex = inspector.getByTestId('part-fill').getByTestId('fill-editor').locator('input.hex');
    await hex.fill(PINK);
    await hex.press('Enter');

    await expect
      .poll(async () => {
        const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1);
        const doc = data?.[0]?.doc as { tracks: { clips: { id: string; partStyles?: Record<string, { fills: { color?: string }[] }> }[] }[] } | undefined;
        return doc?.tracks.flatMap((t) => t.clips).find((c) => c.id === 'poster')?.partStyles?.[SHAPE]?.fills[0]?.color;
      }, { timeout: 10_000 })
      .toBe(PINK);
    await expect.poll(() => shapeFills(page), { timeout: 15_000 }).toContain(PINK_RGB);
    await shoot(page, 'ws-2-recoloured-editor');

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect.poll(async () => !(await tile.screenshot()).equals(tileBefore), { timeout: 20_000 }).toBe(true);
    await shoot(page, 'ws-3-recoloured-tile');

    await page.reload();
    await expect(tile).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(3000);
    await expect.poll(async () => !(await tile.screenshot()).equals(tileBefore), { timeout: 20_000 }).toBe(true);
    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect.poll(() => shapeFills(page), { timeout: 15_000 }).toContain(PINK_RGB);
    await shoot(page, 'ws-4-after-reload');
  });
});
