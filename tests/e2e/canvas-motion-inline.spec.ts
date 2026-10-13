import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const START = /^00:00:00 \//;
const SHOTS = process.env.CANVAS_MOTION_SHOTS;

async function shoot(page: Page, name: string) {
  if (SHOTS) {
    await page.screenshot({ path: `${SHOTS}/${name}.png` });
  }
}

test.describe('motion editor inside the canvas @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('clicking a motion node opens timeline and agent in place; an edit saves; Esc closes', async ({ page, session, admin, seedNode }) => {
    const node = await seedNode({ type: 'motion', x: 80, y: 80, data: LANDSCAPE });
    const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
    expect(error).toBeNull();

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await shoot(page, '1-canvas');
    await page.getByTestId('motion-node-stage').click({ position: { x: 4, y: 4 } });

    const editor = page.getByTestId('motion-editor');
    await expect(editor).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });
    await expect(page).toHaveURL(new RegExp(`/c/${session.canvasId}$`));
    await expect(page.getByRole('region', { name: 'Timeline', exact: true })).toBeVisible();
    await expect(page.getByLabel('Agent', { exact: true })).toBeVisible();
    await page.waitForTimeout(1500);
    await shoot(page, '2-open');

    const timecode = editor.getByTestId('timecode');
    await editor.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(timecode).not.toHaveText(START, { timeout: 5000 });
    await shoot(page, '3-playing');
    await page.keyboard.press('Space');

    await editor.locator('[data-clip-id]').first().click();
    await page.keyboard.press('Delete');
    await expect(editor.locator('[data-clip-id]')).toHaveCount(0);
    await expect.poll(async () => (await admin.from('motion_revisions').select('version').eq('node_id', node.id).order('version', { ascending: false }).limit(1)).data?.[0]?.version ?? 0, { timeout: 10_000 }).toBeGreaterThan(1);
    await shoot(page, '4-edited');

    await page.keyboard.press('Escape');
    await expect(editor).toHaveCount(0);
    await expect(page.getByTestId('motion-node-stage')).toBeVisible();
    expect((await admin.from('nodes').select('deleted_at').eq('id', node.id).single()).data?.deleted_at).toBeNull();
    await shoot(page, '5-closed');
  });
});
