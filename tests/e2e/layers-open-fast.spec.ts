import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import doc from './fixtures/motion-doc.json' with { type: 'json' };
import poster from './fixtures/poster-type-grid.json' with { type: 'json' };

const FRAMES = 10;
const ELEMENTS_BUDGET_MS = 500;
const PARTS_BUDGET_MS = 2_500;
const LANDSCAPE = { format: '16:9', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const PORTRAIT = { format: '4:5', docHeadRevision: 1, posterAssetId: null, lastRenderAssetId: null };
const SPACING = 1200;

test.describe('Layers on canvas open @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('every frame shows its elements as soon as the canvas opens', async ({ page, session, admin, seedNode }) => {
    test.setTimeout(120_000);
    const ids: string[] = [];
    for (let i = 0; i < FRAMES; i++) {
      const still = i % 2 === 1;
      const node = await seedNode({ type: 'motion', x: i * SPACING, y: 0, data: still ? PORTRAIT : LANDSCAPE });
      const { error } = await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: node.id, version: 1, doc: still ? poster : doc, actor_kind: 'user', actor_id: session.userId });
      expect(error).toBeNull();
      ids.push(node.id);
    }

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    const opened = Date.now();
    await page.getByRole('button', { name: 'Layers', exact: true }).click();
    const layers = page.getByTestId('layers');
    await expect(layers.locator(`[data-layer="${ids[0]}"]`)).toBeVisible();

    const framesWith = (kinds: string[]) => layers.locator('[data-kind]').evaluateAll((rows, wanted) => {
      const hit = new Set<string>();
      let node = '';
      for (const r of rows) {
        const kind = r.getAttribute('data-kind') ?? '';
        if (kind === 'node') {
          node = r.getAttribute('data-layer') ?? '';
        } else if (wanted.includes(kind)) {
          hit.add(node);
        }
      }
      return hit.size;
    }, kinds);

    await expect.poll(() => framesWith(['clip', 'group', 'track']), { timeout: 30_000, intervals: [50] }).toBe(FRAMES);
    const allChildren = Date.now() - opened;
    await expect.poll(() => framesWith(['part']), { timeout: 60_000, intervals: [50] }).toBe(FRAMES / 2);
    const allParts = Date.now() - opened;
    console.log(`after hydration: elements of ${FRAMES} frames ${allChildren} ms, parts of ${FRAMES / 2} posters ${allParts} ms`);
    expect(allChildren, `the elements of all ${FRAMES} frames show within ${ELEMENTS_BUDGET_MS} ms`).toBeLessThan(ELEMENTS_BUDGET_MS);
    expect(allParts, `the parts of every poster show within ${PARTS_BUDGET_MS} ms`).toBeLessThan(PARTS_BUDGET_MS);
  });
});
