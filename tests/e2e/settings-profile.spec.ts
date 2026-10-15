import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SHEET_MS = 30_000;

async function openProfile(page: Page, projectId: string) {
  await gotoHydrated(page, `/p/${projectId}/settings/profile`);
  const sheet = page.locator('.canvas-sheet');
  await expect(sheet.locator('#profile-first-name')).toBeEditable({ timeout: SHEET_MS });
  return sheet;
}

test.describe('profile @real', () => {
  test.skip(!REAL_STACK, 'needs the real stack: E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('a saved name stays after the project reloads', async ({ page, session }) => {
    const original = await (await openProfile(page, session.projectId)).locator('#profile-first-name').inputValue();
    const changed = `E2E${Date.now().toString(36)}`;

    for (const value of [changed, original]) {
      const sheet = await openProfile(page, session.projectId);
      await sheet.locator('#profile-first-name').fill(value);
      const saved = page.waitForResponse((r) => r.url().includes('updateProfile') && r.request().method() === 'POST');
      await sheet.locator('form[action="?/updateProfile"] button[type="submit"]').click();
      expect((await saved).status()).toBe(200);

      const reopened = await openProfile(page, session.projectId);
      await expect(reopened.locator('#profile-first-name')).toHaveValue(value);
    }
  });
});
