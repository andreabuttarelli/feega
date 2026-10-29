import type { Locator, Page } from '@playwright/test';

export async function setColour(page: Page, field: Locator, hex: string): Promise<void> {
  const picker = page.getByTestId('colour-picker').last();
  if (!(await picker.isVisible())) {
    await field.locator('button[aria-expanded]').first().click();
  }

  const input = picker.getByTestId('colour-channel').first();
  await input.fill(hex);
  await input.press('Enter');
  await page.keyboard.press('Escape');
}
