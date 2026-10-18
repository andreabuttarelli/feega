import type { Locator, Page } from '@playwright/test';

export const tileOf = (page: Page, id: string): Locator => page.locator(`.svelte-flow__node[data-id="${id}"]`);

export async function hoverTile(page: Page, id: string): Promise<Locator> {
  const tile = tileOf(page, id);
  await tile.hover();
  return tile;
}
