import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const INVITEE = 'team-e2e-invitee@example.com';

test.describe('team of the active organisation @real', () => {
  test.skip(!REAL_STACK, 'richiede lo stack vero: E2E_REAL_STACK=1');

  test('the sidebar switcher shows the active org and the team page invites, revokes and makes a link', async ({ page, session }) => {
    test.setTimeout(90_000);

    await gotoHydrated(page, '/app');
    await expect(page.getByTestId('org-switcher')).toHaveValue(session.orgId);
    await expect(page.getByTestId('new-org')).toBeVisible();

    await gotoHydrated(page, '/app/team');
    await expect(page.getByTestId('team-member').first()).toBeVisible();

    const form = page.getByTestId('team-invite');
    await form.getByRole('textbox').fill(INVITEE);
    await form.getByRole('combobox').selectOption('viewer');
    await form.getByRole('button').click();
    const row = page.getByTestId('team-invite-row').filter({ hasText: INVITEE });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: 'Revoke' }).click();
    await expect(row).toHaveCount(0);

    await page.getByTestId('team-link').click();
    await expect(page.getByTestId('team-link-url')).toContainText('/login?invite_token=');
    await page.getByRole('button', { name: 'Turn off link' }).click();
    await expect(page.getByRole('button', { name: 'Turn off link' })).toHaveCount(0);
  });
});
