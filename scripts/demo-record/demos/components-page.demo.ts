import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { SETTLE_MS, openCanvas } from './seed';

const SITE = process.env.DEMO_SITE ?? 'linear.app';
const IMPORT_MS = 240_000;
const LOOK_MS = 2200;

test('components page', async ({ page, session }) => {
  test.setTimeout(900_000);
  await installCursor(page);
  await openCanvas(page, session);

  await recordDemo(page, { slug: 'components-page', title: 'Feega' }, async (d) => {
    await d.click(page.getByTestId('insert-open'));
    await d.click(page.getByText('From URL…'));
    await d.type(page.getByTestId('url-import-url'), SITE);
    await d.click(page.getByTestId('url-import-run'));
    await d.skip(() => expect(page.getByTestId('url-import-dialog')).toBeHidden({ timeout: IMPORT_MS }));
    await d.wait(SETTLE_MS);

    await d.click(page.getByTestId('frame-settings').locator('summary'));
    const variables = page.getByTestId('variables-library');
    await variables.scrollIntoViewIfNeeded();
    await d.move(variables);
    await d.wait(LOOK_MS);

    const rail = page.locator('nav[data-dock="left-bar"] button');

    await d.click(rail.first());
    const toggle = page.getByTestId('pages-toggle');
    if ((await toggle.getAttribute('aria-expanded')) === 'false') {
      await d.click(toggle);
    }
    await d.click(page.locator('.page-link', { hasText: 'Components' }));
    await expect(page.getByTestId('component-set-outline').first()).toBeVisible({ timeout: 60_000 });
    await d.wait(SETTLE_MS);
    await d.key('Shift+Digit1', '⇧1');
    await d.wait(LOOK_MS);

    const plus = page.getByTestId('component-set-plus').first();
    await d.click(plus);
    await d.wait(LOOK_MS);

    await d.click(page.locator('.page-link').first());
    await d.wait(SETTLE_MS);
    await d.key('Shift+Digit1', '⇧1');
    await d.wait(LOOK_MS);
  });
});
