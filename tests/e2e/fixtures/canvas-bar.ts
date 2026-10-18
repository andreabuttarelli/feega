import type { Locator, Page } from '@playwright/test';

async function pickRadio(radio: Locator): Promise<void> {
  if ((await radio.getAttribute('aria-checked')) !== 'true') {
    await radio.click();
  }
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
