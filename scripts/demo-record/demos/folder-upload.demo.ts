import { resolve } from 'node:path';
import { test, expect, gotoHydrated } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { dropStarted, holdAgent, projectOf, startedCanvas } from './home-helpers';

const TEST_MS = 1_200_000;
const READ_MS = 2400;
const UPLOAD_MS = 60_000;
const SCREEN = { x: 0, y: 0, width: 1600, height: 900 };
const FOLDER = resolve('scripts/demo-record/fixtures/ember-and-rain');
const BRIEF = 'Redesign the menu section as a two column card grid and give the hero more air.';

test('folder upload', async ({ page, session, admin }) => {
  test.setTimeout(TEST_MS);
  await installCursor(page);
  await page.addInitScript(() => delete (window as { showDirectoryPicker?: unknown }).showDirectoryPicker);
  const release = await holdAgent(page);
  await gotoHydrated(page, `/app?project=${session.projectId}`);
  const field = page.getByTestId('video-brief');
  await expect(field).toBeVisible();

  let started: string | null = null;
  try {
    await recordDemo(page, { slug: 'folder-upload', title: 'bring a folder' }, async (d) => {
      await d.look(SCREEN, READ_MS);
      await d.click(page.getByTestId('prompt-kinds').locator('[data-kind="website"]'));

      const chooser = page.waitForEvent('filechooser');
      await d.click(page.getByTestId('prompt-sources').locator('[data-source="upload"]'));
      await (await chooser).setFiles(FOLDER);
      const chip = page.getByTestId('source-chip');
      await d.skip(() => expect(chip).toBeVisible({ timeout: UPLOAD_MS }));
      await expect(page.getByTestId('source-once')).toBeVisible();
      await d.look((await chip.boundingBox())!, READ_MS);

      await d.type(field, BRIEF);
      await d.look((await page.getByTestId('video-brief').boundingBox())!, READ_MS);
    });
    await page.getByTestId('brief-send').click();
    await startedCanvas(page);
    started = projectOf(page.url());
  } finally {
    release();
    await dropStarted(admin, session, started ?? projectOf(page.url()));
  }
});
