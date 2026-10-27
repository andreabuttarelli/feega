import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { asset, frameDoc, frameHost, openCanvas, seedFrame } from './seed';

const FRAMES = 180;

test('scrub a video, cache it in RAM, play it', async ({ page, session, admin, seedNode }) => {
  const video = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'video', source: 'imported', url: asset('/track-demo-clip.mp4') }).select('id').single();
  expect(video.error).toBeNull();
  const clips = [
    { id: 'clip', from: 0, durationInFrames: FRAMES, component: 'Video', props: { assetId: video.data!.id, fit: 'cover' } },
    { id: 'label', from: 0, durationInFrames: FRAMES, component: 'Text', props: { text: 'Morning Mug  €24', size: 0.05, weight: 700, color: '#ffffff', font: 'sans', x: 0.5, y: 0.12, width: 0.4, height: 0.1 } }
  ];
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, frameDoc(clips, { assets: [{ id: video.data!.id, kind: 'video', name: 'mug' }] }, FRAMES));
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(3000);
  const box = (await frameHost(page, id).boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.9);
  await expect(page.getByTestId('frame-timeline')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('frame-timeline-play').scrollIntoViewIfNeeded();
  const first = page.getByText('00:00').first();
  const last = page.getByText('00:06').first();
  const a = (await first.boundingBox())!;
  const b = (await last.boundingBox())!;
  const ruler = { y: a.y + a.height / 2, from: a.x, to: b.x };

  await recordDemo(page, { slug: 'webcodecs-ram-preview', title: 'scrub, cache, play' }, async (d) => {
    await d.drag({ x: ruler.from, y: ruler.y }, { x: ruler.from + (ruler.to - ruler.from) * 0.55, y: ruler.y });
    await d.drag({ x: ruler.from + (ruler.to - ruler.from) * 0.55, y: ruler.y }, { x: ruler.from + (ruler.to - ruler.from) * 0.1, y: ruler.y });
    await d.key('Alt+Enter', '⌥ ↵');
    await expect(page.getByTestId('ram-cache').first()).toBeVisible({ timeout: 60_000 });
    await d.wait(3500);
    await d.click(page.getByTestId('frame-timeline-play'));
    await d.wait(6500);
  });
});
