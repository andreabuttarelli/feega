import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import poster from './fixtures/poster-type-grid.json' with { type: 'json' };

const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const WIDTHS = [1440, 900] as const;
const HEIGHT = 900;

test.describe('the floating inspector never overflows its card @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  for (const width of WIDTHS) {
    test(`a selected element's properties fit the right bar at ${width}px`, async ({ page, session, admin, seedNode }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: HEIGHT });
      const node = await seedNode({ type: 'motion', x: 80, y: 80, data: PORTRAIT });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: poster, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();

      await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
      await page.getByTestId('motion-node-stage').click({ position: { x: 60, y: 10 } });
      const box = (await page.getByTestId('part-box').boundingBox())!;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

      const bar = page.getByTestId('right-bar');
      await expect(bar.getByTestId('motion-inspector')).toBeVisible({ timeout: 15_000 });
      const widths = await bar.evaluate((el) => [...el.querySelectorAll<HTMLElement>('*')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible' && e.tagName !== 'SELECT').length);
      expect(widths, 'no scrolling container inside the inspector').toBe(0);
      const card = await bar.evaluate((el) => {
        const edge = el.getBoundingClientRect().right;
        return [...el.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().right > edge + 1).length;
      });
      expect(card, 'nothing pokes past the right edge of the card').toBe(0);
    });
  }
});
