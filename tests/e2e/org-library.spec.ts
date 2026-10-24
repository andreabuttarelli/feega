import { randomUUID } from 'node:crypto';
import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

const SCREENSHOT = `${process.env.HOME}/Documents/feega-videos/e2e/f3-org-library.png`;

test.describe('org asset library @real', () => {
  test.skip(!REAL_STACK, 'requires E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('an asset saved in project A appears in the library of project B', async ({ page, session, admin }) => {
    const otherProjectId = randomUUID();
    const marker = `library ${Date.now().toString(36)}`;

    const seeded = await admin
      .from('assets')
      .insert({ org_id: session.orgId, project_id: session.projectId, type: 'text', content: marker, source: 'upload' })
      .select('id')
      .single();
    expect(seeded.error).toBeNull();

    const other = await admin.from('projects').insert({ id: otherProjectId, org_id: session.orgId, name: 'E2E library B', slug: `e2e-library-${otherProjectId}` });
    expect(other.error).toBeNull();

    try {
      await gotoHydrated(page, `/p/${session.projectId}/assets`);

      const saved = page.waitForResponse((r) => r.url().includes('saveToLibrary') && r.request().method() === 'POST');
      await page.getByTestId('save-to-library').first().click();
      expect((await saved).ok()).toBe(true);
      await expect(page.getByText('Saved to library')).toBeVisible();

      await gotoHydrated(page, `/p/${otherProjectId}/assets?source=library`);
      await expect(page.getByText(marker)).toBeVisible();
      await expect(page.getByTestId('save-to-library')).toHaveCount(0);

      await page.screenshot({ path: SCREENSHOT, fullPage: true });

      await gotoHydrated(page, `/p/${otherProjectId}/assets`);
      await expect(page.getByText(marker)).toHaveCount(0);
    } finally {
      await admin.from('assets').delete().eq('org_id', session.orgId).is('project_id', null).eq('content', marker);
      await admin.from('projects').delete().eq('id', otherProjectId);
    }
  });
});
