import { readFileSync } from 'node:fs';
import { test, expect, gotoHydrated } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { dropStarted, holdAgent, projectOf, startedCanvas } from './home-helpers';

const TEST_MS = 1_200_000;
const READ_MS = 2400;
const SCREEN = { x: 0, y: 0, width: 1600, height: 900 };
const PHOTO = { name: 'ember-and-rain.webp', mimeType: 'image/webp', buffer: readFileSync('static/onboarding/example-image.webp') };
const REPO = 'https://github.com/emberandrain/site';
const BRIEF = 'Landing page for Ember & Rain, a coffee bar in Leith. Warm dark palette from the photo, hero with this shot, a menu of six drinks with prices, opening hours and a book a table button.';

test('home prompt', async ({ page, session, admin }) => {
  test.setTimeout(TEST_MS);
  await installCursor(page);
  const release = await holdAgent(page);
  await gotoHydrated(page, '/app');
  const field = page.getByTestId('video-brief');
  await expect(field).toBeVisible();

  let started: string | null = null;
  try {
    await recordDemo(page, { slug: 'home-prompt', title: 'one prompt, one canvas' }, async (d) => {
      await d.look(SCREEN, READ_MS);
      await d.click(page.getByTestId('prompt-kinds').locator('[data-kind="website"]'));

      await d.click(page.getByTestId('prompt-sources').locator('[data-source="github"]'));
      await d.type(page.getByTestId('source-value'), REPO);
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('source-chip')).toBeVisible();
      await d.look((await page.getByTestId('source-chip').boundingBox())!, READ_MS);
      await d.click(page.getByTestId('source-chip').getByRole('button', { name: 'Remove source' }));

      const chooser = page.waitForEvent('filechooser');
      await d.click(page.getByTestId('chat-attach'));
      await (await chooser).setFiles(PHOTO);
      await d.skip(() => expect(page.getByTestId('brief-send')).toBeEnabled({ timeout: 30_000 }));

      await d.type(field, BRIEF);
      await d.click(page.getByTestId('brief-send'));
      await d.skip(() => startedCanvas(page));
      started = projectOf(page.url());
      await d.look(SCREEN, READ_MS * 2);
    });
  } finally {
    release();
    await dropStarted(admin, session, started ?? projectOf(page.url()));
  }
});
