import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const MOTION_DATA = { format: 'landscape', docHeadRevision: 0, posterAssetId: null, lastRenderAssetId: null };
const SHOTS = process.env.E2E_SHOTS_DIR;

test.describe('motion template @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');

  test('Add → Components finds Prompt input, previews it, inserts an editable copy with its sounds, and the inspector leads with its key fields', async ({ page, session, seedNode }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const node = await seedNode({ type: 'motion', data: MOTION_DATA });
    await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}/motion/${node.id}`);

    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByTestId('open-components').click();
    const library = page.getByTestId('component-library');
    await library.getByTestId('component-search').fill('prompt');
    await library.locator('[data-component="builtin:prompt-input"]').click();
    await expect(library.getByTestId('component-detail')).toContainText('Prompt input');
    await page.waitForTimeout(1500);
    if (SHOTS) {
      await library.screenshot({ path: `${SHOTS}/editor-1-library.png` });
    }

    await page.getByTestId('insert-component').click();
    const inspector = page.getByTestId('template-inspector');
    await expect(inspector).toBeVisible();
    await expect(inspector.getByTestId('key-fields')).toContainText('Typed text');
    const advanced = inspector.getByTestId('advanced-fields');
    await expect(advanced).not.toHaveAttribute('open');
    await advanced.locator('summary').click();
    await expect(advanced.getByTestId('field-group')).toHaveText(['Text', 'Style', 'Motion']);
    if (SHOTS) {
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${SHOTS}/editor-2-inserted.png` });
      await inspector.screenshot({ path: `${SHOTS}/editor-3-inspector.png` });
    }

    const typed = inspector.getByTestId('key-fields').getByRole('textbox').first();
    await typed.fill('Zqx typed from the inspector');
    await typed.blur();
    await expect(typed).toHaveValue('Zqx typed from the inspector');
  });
});
