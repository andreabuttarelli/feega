import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SCREENSHOT = `${process.env.HOME}/Documents/feega-videos/e2e/f3-spend-caps.png`;

test.describe('settings billing limits @real', () => {
  test.skip(!REAL_STACK, 'requires E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('the page lists the three limits, and saving answers whether or not the table exists', async ({ page, session, admin }) => {
    const table = await admin.from('org_spend_caps').select('scope').eq('org_id', session.orgId).limit(1);
    const migrated = !table.error;

    await gotoHydrated(page, `/p/${session.projectId}/settings/spend`);
    for (const scope of ['org_member', 'project_member', 'project_total']) {
      await expect(page.getByTestId(`cap-${scope}`)).toBeVisible();
    }

    const form = page.getByTestId('cap-org_member');
    await form.locator('input[name="cap_usd"]').fill('12.5');
    await form.locator('select[name="reset"]').selectOption('monthly');
    await form.getByRole('button', { name: 'Save' }).click();

    try {
      if (migrated) {
        await expect(page.getByText('Saved.')).toBeVisible();
        await gotoHydrated(page, `/p/${session.projectId}/settings/spend`);
        await expect(page.getByTestId('cap-org_member').locator('input[name="cap_usd"]')).toHaveValue('12.5');
      } else {
        await expect(page.getByText('Could not save. Try again later.')).toBeVisible();
      }
      await page.screenshot({ path: SCREENSHOT, fullPage: true });
    } finally {
      if (migrated) {
        await admin.from('org_spend_caps').delete().eq('org_id', session.orgId).eq('scope', 'org_member');
      }
    }
  });
});
