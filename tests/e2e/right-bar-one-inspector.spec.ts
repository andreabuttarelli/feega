import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import type { Page } from '@playwright/test';
import doc from './fixtures/motion-doc.json' with { type: 'json' };

const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const EDITED_WIDTH = 1234;

async function openFrame(page: Page, id: string) {
  await page.locator(`.svelte-flow__node[data-id="${id}"]`).getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
  await expect(page.getByTestId('motion-editor')).toHaveAttribute('data-mount', 'canvas', { timeout: 15_000 });
  await page.getByTestId('right-bar').getByTestId('side-tab-properties').click();
}

async function closeFrame(page: Page) {
  await page.getByTestId('inline-close').click();
  await expect(page.getByTestId('motion-editor')).toHaveCount(0, { timeout: 10_000 });
}

test.describe('the Properties tab holds only the open editor inspector @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('frame A closed, frame B open: one inspector, and its edits land on B', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const ids: string[] = [];
    for (const x of [80, 900]) {
      const node = await seedNode({ type: 'motion', x, y: 120, data: LANDSCAPE });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      ids.push(node.id);
    }
    const [a, b] = ids;

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await openFrame(page, a);
    await expect(page.getByTestId('right-bar').getByTestId('composition-inspector')).toHaveCount(1);
    await closeFrame(page);
    await expect(page.getByTestId('right-bar').getByTestId('composition-inspector')).toHaveCount(0);

    await openFrame(page, b);
    const inspector = page.getByTestId('right-bar').getByTestId('composition-inspector');
    await expect(inspector).toHaveCount(1);
    await expect(page.getByTestId('right-bar').locator('[data-pane="properties"]')).toHaveCount(1);

    await inspector.getByTestId('frame-width').fill(String(EDITED_WIDTH));
    await inspector.getByTestId('frame-width').press('Enter');

    const latestWidth = async (id: string) => {
      const { data } = await admin.from('motion_revisions').select('doc').eq('node_id', id).order('version', { ascending: false }).limit(1).single();
      return (data?.doc as { width?: number } | undefined)?.width;
    };
    await expect.poll(() => latestWidth(b), { timeout: 15_000 }).toBe(EDITED_WIDTH);
    expect(await latestWidth(a)).toBe(doc.width);
  });
});
