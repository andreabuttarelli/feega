import { expect, type Locator, type Page } from '@playwright/test';

export async function openInsert(page: Page): Promise<Locator> {
  const menu = page.getByTestId('insert-menu');
  if (!(await menu.count())) {
    await page.getByTestId('add-bar').getByTestId('insert-open').click();
  }
  await expect(menu).toBeVisible();
  return menu;
}

export async function barTool(page: Page, tool: string): Promise<Locator> {
  return (await openInsert(page)).locator(`[data-tool="${tool}"]`);
}

export async function pickBarTool(page: Page, tool: string): Promise<void> {
  if (tool === 'select') {
    await page.getByTestId('add-bar').locator('[data-tool="select"]').click();
    return;
  }
  await (await barTool(page, tool)).click();
}

export const pickFrameTool = pickBarTool;
