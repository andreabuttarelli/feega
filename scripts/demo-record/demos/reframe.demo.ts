import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { asset, openCanvas } from './seed';

const GRIP_PX = 20;

test('reframe a video, and open the image dialog', async ({ page, session, admin, seedNode }) => {
  const clip = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'video', source: 'imported', url: asset('/reframe-demo-clip.mp4') }).select('id').single();
  const photo = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'image', source: 'imported', url: asset('/templates/product-lifestyle.webp') }).select('id').single();
  expect(clip.error).toBeNull();
  expect(photo.error).toBeNull();
  const video = await seedNode({ type: 'video', x: 0, y: 0, data: { prompt: 'Landing page walkthrough', refId: clip.data!.id } });
  const image = await seedNode({ type: 'image', x: 900, y: 0, data: { prompt: 'Product on the table', refId: photo.data!.id } });

  await installCursor(page);
  await openCanvas(page, session);
  await page.waitForTimeout(2000);

  const grip = async (id: string) => {
    const b = (await page.locator(`[data-testid="gpu-node"][data-id="${id}"]`).boundingBox())!;
    return { x: b.x + GRIP_PX, y: b.y + b.height - GRIP_PX };
  };
  const openReframe = async (d: Parameters<Parameters<typeof recordDemo>[2]>[0], id: string) => {
    await d.click(await grip(id));
    await d.click(page.getByRole('button', { name: 'Reframe…', exact: true }));
    await expect(page.getByTestId('reframe-dialog')).toBeVisible();
  };

  await recordDemo(page, { slug: 'reframe', title: 'reframe to another aspect' }, async (d) => {
    await openReframe(d, video.id);
    await d.click(page.getByTestId('reframe-9:16'));
    const x = page.getByTestId('reframe-focus-x');
    const b = (await x.boundingBox())!;
    await d.drag({ x: b.x + b.width / 2, y: b.y + b.height / 2 }, { x: b.x + b.width * 0.25, y: b.y + b.height / 2 });
    await d.click(page.getByTestId('reframe-apply'));
    await expect(page.locator('[data-testid="gpu-node"]')).toHaveCount(3, { timeout: 90_000 });
    await d.wait(3000);

    await openReframe(d, image.id);
    await d.click(page.getByTestId('reframe-1:1'));
    await d.wait(2500);
    await d.key('Escape', 'Esc');
    await d.wait(800);
  });
});
