import type { FrameLocator, Locator, Page } from '@playwright/test';

export const CODE_FRAME = '[data-testid=code-frame]';

export type Point = { x: number; y: number };

export async function editCanvas(page: Page, projectId: string, body: Record<string, unknown>) {
  const res = await page.request.post('/api/v1/edit', { data: { project_id: projectId, ...body } });
  return res.json();
}

export async function openLocalCanvas(page: Page): Promise<{ projectId: string; canvasId: string }> {
  await page.goto('/');
  const [, projectId, canvasId] = page.url().match(/\/p\/([^/]+)\/c\/([^/?]+)/)!;
  const listed = await editCanvas(page, projectId, { op: 'list_nodes', input: { canvasId } });
  for (const node of listed.nodes ?? []) {
    await editCanvas(page, projectId, { op: 'delete_node', target: node.id });
  }
  return { projectId, canvasId };
}

export async function pointIn(page: Page, host: Locator, frame: FrameLocator, target: Locator): Promise<Point> {
  const box = (await host.boundingBox())!;
  const inner = await frame.locator('body').evaluate(() => innerWidth);
  const k = box.width / inner;
  const r = await target.evaluate((e) => {
    const b = e.getBoundingClientRect();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  });
  return { x: box.x + r.x * k, y: box.y + r.y * k };
}
