import { test, expect, REAL_STACK, gotoHydrated } from './fixtures/session';

/**
 * IMPOSTAZIONI DEL BRAND: vivono nel dashboard (`/app/settings/brands`), non nella tela. Un
 * progetto senza brand (`projects.brand_id` nullable, il caso normale) che apre il vecchio URL
 * della tela arriva all'elenco dei brand, mai a un 400. Da lì si crea un brand, si controlla che
 * il form abbia tutti i campi, si salva e si verifica che persista dopo un reload.
 */
const BRANDS = '/app/settings/brands';
const EDIT = 'form[action="?/update"]';

test.describe('settings brand @real', () => {
  test.skip(!REAL_STACK, 'richiede uno stack disposable: E2E_REAL_STACK=1');
  test.setTimeout(120_000);

  test('progetto senza brand: il vecchio URL porta all elenco, non a un 400', async ({ page, session }) => {
    await gotoHydrated(page, `/p/${session.projectId}/settings/brand`);

    await expect(page).toHaveURL(new RegExp(`${BRANDS}$`));
    await expect(page.locator('input[name="name"]')).toBeVisible();
  });

  test('creare un brand porta al form con tutti i campi, editabile e persistente', async ({ page, session, admin }) => {
    await gotoHydrated(page, BRANDS);

    const brandName = `E2E brand ${Date.now().toString(36)}`;
    await page.locator('input[name="name"]').fill(brandName);
    await page.locator('button[type="submit"]').click();

    try {
      await expect(page.locator(EDIT)).toBeVisible({ timeout: 10_000 });

      await expect(page.locator('form[action="?/uploadLogo"]')).toBeAttached();
      const nameInput = page.locator(`${EDIT} input[name="name"]`);
      const slugInput = page.locator(`${EDIT} input:disabled`);
      const websiteInput = page.locator(`${EDIT} input[name="website"]`);
      const shortDescInput = page.locator(`${EDIT} input[name="short_description"]`);
      const contentInput = page.locator(`${EDIT} textarea[name="content"]`);

      await expect(nameInput).toHaveValue(brandName);
      await expect(slugInput).toBeVisible();
      await expect(websiteInput).toBeVisible();
      await expect(shortDescInput).toBeVisible();
      await expect(contentInput).toBeVisible();

      await nameInput.fill(`${brandName} edited`);
      await websiteInput.fill('https://example.com');
      await shortDescInput.fill('A test brand, edited');
      await contentInput.fill('Some content about the brand, written by the e2e spec.');
      const saved = page.waitForResponse((r) => r.url().includes('action=update') && r.request().method() === 'POST');
      await page.locator(`${EDIT} button[type="submit"]`).click();
      expect((await saved).status()).toBe(200);
      await expect(page.getByText('Saved.')).toBeVisible({ timeout: 10_000 });

      await page.reload();
      await expect(page.locator(`${EDIT} input[name="name"]`)).toHaveValue(`${brandName} edited`, { timeout: 30_000 });
      await expect(page.locator(`${EDIT} input[name="website"]`)).toHaveValue('https://example.com');
      await expect(page.locator(`${EDIT} input[name="short_description"]`)).toHaveValue('A test brand, edited');
    } finally {
      await admin.from('brands').delete().eq('org_id', session.orgId).like('name', `${brandName}%`);
    }
  });
});
