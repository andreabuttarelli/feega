import { test, expect, gotoHydrated } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';

const TEST_MS = 300_000;
const READ_MS = 2000;
const CLIENTS = ['claude-code', 'codex', 'cursor'];

test('connect agent', async ({ page, context }) => {
  test.setTimeout(TEST_MS);
  await installCursor(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await gotoHydrated(page, '/app');
  const card = page.getByTestId('home-agent');
  await card.scrollIntoViewIfNeeded();
  await expect(card).toBeVisible();

  await recordDemo(page, { slug: 'connect-agent', title: 'connect your agent' }, async (d) => {
    await d.look((await card.boundingBox())!, READ_MS);
    for (const id of CLIENTS) {
      await d.click(page.getByTestId(`agent-tab-${id}`));
      const snippet = card.getByTestId('agent-snippet').first();
      await d.look((await snippet.boundingBox())!, READ_MS);
      await d.click(snippet.getByTestId('agent-copy'));
      await expect(snippet.getByTestId('agent-copy')).toHaveAttribute('aria-label', 'Copied');
      await d.wait(900);
    }
    await d.look((await card.boundingBox())!, READ_MS);
  });
});
