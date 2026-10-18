import type { Page } from '@playwright/test';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SETTINGS_API = /\/api\/v1\/me\/projects\/[^/]+\/settings/;
const SHEET_MS = 30_000;

async function openSettings(page: Page, projectId: string, section: string) {
  const loaded = page.waitForResponse((r) => SETTINGS_API.test(r.url()) && r.url().includes(`settings%2F${section}`) && r.request().method() === 'GET');
  await gotoHydrated(page, `/p/${projectId}/settings/${section}`);
  expect((await loaded).status()).toBe(200);
  const sheet = page.locator('.canvas-sheet');
  await expect(sheet).toBeVisible({ timeout: SHEET_MS });
  return sheet;
}

async function submitted(page: Page, action: string, submit: () => Promise<void>) {
  const answer = page.waitForResponse((r) => SETTINGS_API.test(r.url()) && r.url().includes(`action=${action}`) && r.request().method() === 'POST');
  await submit();
  const response = await answer;
  expect(response.status(), await response.text()).toBe(200);
}

test.describe('settings from the API @real', () => {
  test.skip(!REAL_STACK, 'needs the real stack: E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('the project page loads from the API and renames the project', async ({ page, session }) => {
    const sheet = await openSettings(page, session.projectId, 'project');

    const name = `E2E renamed ${Date.now().toString(36)}`;
    const form = sheet.locator('form[action="?/rename"]');
    await expect(form.locator('input[name="name"]')).toHaveValue('E2E project');
    await form.locator('input[name="name"]').fill(name);
    await submitted(page, 'rename', () => form.locator('button[type="submit"]').click());

    const reopened = await openSettings(page, session.projectId, 'project');
    await expect(reopened.locator('form[action="?/rename"] input[name="name"]')).toHaveValue(name);
  });

  test('an API key is created and revoked', async ({ page, session }) => {
    const sheet = await openSettings(page, session.projectId, 'api-keys');

    const keyName = `e2e-${Date.now().toString(36)}`;
    await sheet.getByRole('button', { name: 'Create API Key' }).first().click();
    const create = page.locator('form[action="?/createApiKey"]');
    await create.locator('input[name="key_name"]').fill(keyName);
    await submitted(page, 'createApiKey', () => create.locator('button[type="submit"]').click());

    const row = sheet.locator('.apikey-row').filter({ hasText: keyName });
    await expect(sheet.locator('.apikey-raw')).toBeVisible();
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: 'Revoke' }).click();
    await submitted(page, 'revokeApiKey', () => row.locator('form[action="?/revokeApiKey"] button').click());
    await expect(sheet.locator('.apikey-row').filter({ hasText: keyName })).toHaveCount(0);
  });
});
