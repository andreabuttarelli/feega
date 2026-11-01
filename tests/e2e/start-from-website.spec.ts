import { test, expect, REAL_STACK, dropProject } from './fixtures/session';

const SITE = 'https://example.com';
const CANVAS_PATH = /^\/p\/([^/]+)\/c\/[^/]+$/;

test.describe('start from your website @real', () => {
  test.skip(!REAL_STACK, 'E2E_REAL_STACK=1');
  test.setTimeout(180_000);

  test('a signed-in visitor goes through the start page to a canvas with the page imported', async ({ page, session, admin }) => {
    await page.route('**/brand-from-site', (route) => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'model_skipped_in_e2e' }) }));
    let projectId: string | null = null;
    let orgId = session.orgId;
    try {
      await page.goto(`/?start_url=${encodeURIComponent(SITE)}`);

      await expect(page.getByTestId('start-page')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('start-step-read')).toContainText('example.com');
      await expect(page.getByTestId('start-step-import')).toHaveAttribute('data-state', 'done', { timeout: 120_000 });
      await expect(page.getByTestId('start-step-brand')).toContainText('Brand analysis unavailable');
      await page.getByTestId('start-open-canvas').click();

      await expect(page).toHaveURL((url) => CANVAS_PATH.test(url.pathname), { timeout: 30_000 });
      projectId = new URL(page.url()).pathname.match(CANVAS_PATH)![1];
      expect(projectId).not.toBe(session.projectId);

      const { data: project } = await admin.from('projects').select('name, org_id').eq('id', projectId).single();
      expect(project?.name).toBe('example.com');
      orgId = project?.org_id ?? orgId;

      await expect(page.locator('[data-testid="gpu-node"]')).not.toHaveCount(0, { timeout: 30_000 });
    } finally {
      if (projectId && projectId !== session.projectId) {
        await dropProject(admin, orgId, projectId);
      }
    }
  });
});
