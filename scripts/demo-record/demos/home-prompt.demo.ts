import { test, expect, gotoHydrated } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';

const SHOTS = process.env.DEMO_SHOTS_DIR ?? '/tmp';

const STUB_REPLY = [
  { type: 'start' },
  { type: 'text-start', id: 't' },
  { type: 'text-delta', id: 't', delta: 'On it: a Desktop frame for the bakery landing page, hero first.' },
  { type: 'text-end', id: 't' },
  { type: 'finish' }
];

test('home prompt', async ({ page, browser, session }) => {
  const signedOut = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await signedOut.goto('/new');
  await expect(signedOut.getByRole('heading', { name: 'what do you want to make?' })).toBeVisible();
  await signedOut.screenshot({ path: `${SHOTS}/home-prompt-signed-out.png` });
  await signedOut.close();

  await page.route('**/api/v1/projects/*/agent', (route) => {
    if (route.request().method() !== 'POST') {
      return route.continue();
    }
    const body = STUB_REPLY.map((part) => `data: ${JSON.stringify(part)}\n\n`).join('') + 'data: [DONE]\n\n';
    return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' }, body });
  });

  await installCursor(page);
  await gotoHydrated(page, '/app');
  await expect(page.getByTestId('prompt-kinds')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/home-prompt-app.png` });

  await recordDemo(page, { slug: 'home-prompt', title: 'one prompt, straight to a canvas' }, async (d) => {
    await d.click(page.locator('[data-kind="website"]'));
    await d.type(page.getByTestId('video-brief'), 'A landing page for a neighbourhood bakery: warm, editorial, big photos of bread');
    await page.screenshot({ path: `${SHOTS}/home-prompt-typed.png` });
    await d.click(page.getByTestId('brief-send'));
    await page.waitForURL(/\/p\/[^/]+\/c\//, { timeout: 60_000 });
    await d.wait(6000);
    await page.screenshot({ path: `${SHOTS}/home-prompt-canvas.png` });
  });
});
