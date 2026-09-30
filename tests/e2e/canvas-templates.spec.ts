import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';
import { CANVAS_TEMPLATES } from '../../src/lib/canvas/templates';

const SHOTS = process.env.E2E_SHOTS_DIR;

test.describe('canvas templates @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('ogni template si posa sulla tela con i suoi nodi e le sue linee', async ({ page, session, admin }) => {
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);

    let expectedNodes = 0;
    let expectedEdges = 0;
    for (const template of CANVAS_TEMPLATES) {
      await page.getByRole('button', { name: 'Templates', exact: true }).click();
      if (SHOTS && template === CANVAS_TEMPLATES[0]) {
        await page.screenshot({ path: `${SHOTS}/gallery.png` });
      }
      await page.getByRole('menuitem', { name: new RegExp(`^${template.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) }).click();

      expectedNodes += template.nodes.length;
      expectedEdges += template.edges.length;
      await expect(page.locator('.svelte-flow__node')).toHaveCount(expectedNodes);
      await expect(page.locator('.svelte-flow__edge')).toHaveCount(expectedEdges);
      if (SHOTS) {
        await page.screenshot({ path: `${SHOTS}/${template.id}.png` });
      }
      await page.keyboard.press('Delete');
      expectedNodes -= template.nodes.length;
      expectedEdges -= template.edges.length;
      await expect(page.locator('.svelte-flow__node')).toHaveCount(expectedNodes);
    }

    const { data: events } = await admin.from('nodes').select('id').eq('canvas_id', session.canvasId);
    expect(events?.length).toBe(CANVAS_TEMPLATES.reduce((sum, t) => sum + t.nodes.length, 0));
  });

  test('un nodo testo di un template genera davvero', async ({ page, session }) => {
    test.skip(!process.env.OPENROUTER_API_KEY, 'OPENROUTER_API_KEY assente: salto la chiamata reale');

    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
    await page.getByRole('button', { name: 'Templates', exact: true }).click();
    await page.getByRole('menuitem', { name: /^One idea, every platform/ }).click();
    await expect(page.locator('.svelte-flow__node')).toHaveCount(5);

    await page.locator('.svelte-flow__pane').click({ position: { x: 5, y: 5 } });
    const caption = page.locator('.svelte-flow__node').nth(1);
    await caption.click();
    await caption.getByRole('button', { name: /^Generate/ }).click();

    await expect(caption.locator('.gen-text')).toContainText(/compostable/i, { timeout: 90_000 });
    if (SHOTS) {
      await page.screenshot({ path: `${SHOTS}/generated.png` });
    }
  });
});
