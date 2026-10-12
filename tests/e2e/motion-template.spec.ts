import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const MOTION_DATA = { format: 'landscape', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.E2E_SHOTS_DIR;

test.describe('motion template @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('Add → Prompt input previews it, inserts an editable copy with its sounds, and the inspector groups its fields', async ({ page, session, seedNode }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);

    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByTestId('add-prompt-input').click();
    const library = page.getByTestId('template-library');
    await expect(library.getByRole('button', { name: 'Prompt input', exact: true })).toHaveClass(/on/);
    await page.waitForTimeout(2500);
    if (SHOTS) {
      await library.screenshot({ path: `${SHOTS}/editor-1-library.png` });
    }

    await page.getByTestId('insert-template').click();
    const inspector = page.getByTestId('template-inspector');
    await expect(inspector).toBeVisible();
    await expect(inspector.getByTestId('field-group')).toHaveText(['Text', 'Style', 'Motion']);
    if (SHOTS) {
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SHOTS}/editor-2-inserted.png` });
      await inspector.screenshot({ path: `${SHOTS}/editor-3-inspector.png` });
    }

    await inspector.getByRole('textbox').first().fill('Zqx typed from the inspector');
    await inspector.getByRole('textbox').first().blur();
    await expect(inspector.getByRole('textbox').first()).toHaveValue('Zqx typed from the inspector');
  });
});
