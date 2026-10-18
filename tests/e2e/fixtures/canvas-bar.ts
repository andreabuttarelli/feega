import type { Locator, Page } from '@playwright/test';

export async function barTool(page: Page, tool: string): Promise<Locator> {
  const bar = page.getByTestId('add-bar');
  const design = bar.getByTestId('bar-mode').getByRole('radio', { name: 'Design' });
  if ((await design.getAttribute('aria-checked')) !== 'true') {
    await design.click();
  }
  return bar.getByTestId('draw-tools').locator(`[data-tool="${tool}"]`);
}

export async function pickBarTool(page: Page, tool: string): Promise<void> {
  await (await barTool(page, tool)).click();
}
