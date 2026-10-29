import { expect, type Locator, type Page } from '@playwright/test';

async function pickRadio(radio: Locator): Promise<void> {
  await expect(async () => {
    if ((await radio.getAttribute('aria-checked')) !== 'true') {
      await radio.click();
    }
    await expect(radio).toHaveAttribute('aria-checked', 'true', { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
}

export async function barTool(page: Page, tool: string): Promise<Locator> {
  const bar = page.getByTestId('add-bar');
  await pickRadio(bar.getByTestId('bar-mode').getByRole('radio', { name: 'Design' }));
  return bar.getByTestId('draw-tools').locator(`[data-tool="${tool}"]`);
}

export async function pickBarTool(page: Page, tool: string): Promise<void> {
  await (await barTool(page, tool)).click();
}

export async function pickFrameTool(page: Page, tool: string): Promise<void> {
  const design = page.getByTestId('edit-mode').locator('[data-mode="design"]');
  if (await design.count()) {
    await pickRadio(design);
  }
  await page.getByTestId('draw-tools').locator(`[data-tool="${tool}"]`).click();
}
