import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import poster from './fixtures/poster-type-grid.json' with { type: 'json' };

const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.CANVAS_MOTION_SHOTS;
const TITLE_LINE = 'lines:0';
const TYPED = 'HELLO';

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

test.use({ video: SHOTS ? 'on' : 'off' });

test.describe('poster parts on the canvas @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('a poster opens on the canvas; its title is a part: select it, edit it in place, saved', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: poster, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
    await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mode', 'still', { timeout: 15_000 });

    const overlay = page.getByTestId('selection-overlay');
    await expect(overlay).toBeVisible({ timeout: 15_000 });
    const box = (await overlay.boundingBox())!;
    const title = { x: box.width * 0.4, y: box.height * 0.1 };

    await expect(async () => {
      await overlay.click({ position: title });
      await expect(page.getByTestId('selection-box')).toBeVisible({ timeout: 1000 });
    }, 'the poster selects once the preview has measured it').toPass({ timeout: 15_000 });
    await overlay.click({ position: title });
    const part = page.getByTestId('part-box');
    await expect(part).toHaveAttribute('data-part', TITLE_LINE);
    await shoot(page, '8-poster-part');

    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layerRow = page.getByTestId('layers').locator(`[data-layer="poster#${TITLE_LINE}"]`);
    await expect(layerRow).toHaveAttribute('aria-selected', 'true');

    const inspector = page.getByTestId('motion-inspector');
    await expect(inspector.locator('#f-lines')).toBeVisible();
    await expect(inspector.locator('#f-ink')).toBeVisible();
    await expect(inspector.locator('[data-prop="fill"]')).toBeVisible();
    await shoot(page, '8b-poster-part-properties');

    const ink = '#ff00aa';
    await inspector.locator('#f-ink').evaluate((el: HTMLInputElement, value: string) => {
      el.value = value;
      el.dispatchEvent(new Event('change'));
    }, ink);

    await expect
      .poll(async () => {
        const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1);
        const doc = data?.[0]?.doc as { tracks: { clips: { id: string; props: { ink?: string } }[] }[] } | undefined;
        return doc?.tracks.flatMap((t) => t.clips).find((c) => c.id === 'poster')?.props.ink;
      }, { timeout: 10_000 })
      .toBe(ink);

    await layerRow.click();
    await overlay.dblclick({ position: title });
    const field = page.getByTestId('part-edit');
    await expect(field).toBeVisible();
    await field.fill(TYPED);
    await field.press('Enter');
    await shoot(page, '9-poster-edited');

    await expect
      .poll(async () => {
        const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', node.id).order('version', { ascending: false }).limit(1);
        const doc = data?.[0]?.doc as { tracks: { clips: { id: string; props: { lines?: string } }[] }[] } | undefined;
        return doc?.tracks.flatMap((t) => t.clips).find((c) => c.id === 'poster')?.props.lines?.split('\n')[0];
      }, { timeout: 10_000 })
      .toBe(TYPED);
  });
});
