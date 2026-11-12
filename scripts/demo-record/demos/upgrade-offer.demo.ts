import { test, expect, gotoHydrated } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';

const TEST_MS = 300_000;
const READ_MS = 2500;
const HOUR_MS = 3_600_000;
const HTTP_PAYMENT_REQUIRED = 402;
const AGENT_POST = /\/api\/v1\/projects\/[^/]+\/agent$/;
const OFFER = /\/api\/v1\/projects\/[^/]+\/upgrade-offer$/;
const BRIEF = 'Turn the Ember & Rain menu into a 6 second autumn launch loop';

test('upgrade offer', async ({ page, session }) => {
  test.setTimeout(TEST_MS);
  await installCursor(page);
  await page.route(AGENT_POST, (route) => route.fulfill({ status: HTTP_PAYMENT_REQUIRED, json: { error: 'out of credits' } }));
  await page.route(OFFER, (route) => route.fulfill({ json: { state: 'live', expiresAt: Date.now() + HOUR_MS } }));
  await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
  const input = page.locator('#chat-composer-input');
  const showChat = page.getByRole('button', { name: 'Show chat' });
  await expect(showChat).toBeVisible({ timeout: 60_000 });

  await recordDemo(page, { slug: 'upgrade-offer', title: '15% off, for one hour' }, async (d) => {
    await d.click(showChat);
    await expect(input).toBeVisible();
    await d.type(input, BRIEF);
    await d.wait(400);
    await input.press('Enter');
    const banner = page.getByTestId('upgrade-offer');
    await d.skip(() => expect(banner).toBeVisible({ timeout: 30_000 }));
    await d.look((await banner.boundingBox())!, READ_MS);
    await page.getByTestId('upgrade-offer').getByRole('link', { name: 'Upgrade' }).hover({ timeout: 10_000 });
    await d.look((await banner.boundingBox())!, READ_MS);
  });
});
