import { test, expect } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { asset, frameDoc, frameHost, openCanvas, seedFrame, solid } from './seed';

const SPAN = 150;
const page_ = { id: 'page', from: 0, durationInFrames: SPAN, component: 'Shape', props: { shape: 'rect', x: 0.5, y: 0.5, width: 1, height: 1, fills: solid('#f6f1ea') } };
const photo = { id: 'photo', from: 0, durationInFrames: SPAN, component: 'Shape', props: { shape: 'rect', x: 0.27, y: 0.5, width: 0.46, height: 0.86, fills: [{ type: 'image', src: asset('/templates/product-lifestyle.webp'), fit: 'cover' }] } };
const title = { id: 'title', from: 0, durationInFrames: SPAN, component: 'Text', props: { text: 'Mornings, made slower.', size: 0.07, weight: 600, color: '#1d1a16', font: 'sans', x: 0.73, y: 0.3, width: 0.4, height: 0.2 } };

test('keyframes on size and adjustment strength', async ({ page, session, admin, seedNode }) => {
  const row = await admin.from('assets').insert({ org_id: session.orgId, project_id: session.projectId, type: 'image', source: 'imported', url: asset('/icon-512.png') }).select('id').single();
  expect(row.error).toBeNull();
  const mock = { id: 'logo', from: 0, durationInFrames: SPAN, component: 'Logo', props: { assetId: row.data!.id, x: 0.73, y: 0.68, width: 0.1, height: 0.18 } };
  const doc = frameDoc([], {
    assets: [{ id: row.data!.id, kind: 'image', name: 'mug' }],
    tracks: [
      { id: 'v1', kind: 'visual', name: 'Video 1', clips: [page_, photo, title, mock] }
    ]
  });
  const id = await seedFrame(seedNode, admin, session, { x: 80, y: 80 }, doc);
  await installCursor(page);
  await openCanvas(page, session);
  await expect(frameHost(page, id)).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2500);
  const box = (await frameHost(page, id).boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.5);
  await page.waitForTimeout(6000);
  await page.getByTestId('side-tab-properties').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/claude-501/x/a.png' });
  const layer = (name: string) => page.getByText(name, { exact: true }).first();

  await recordDemo(page, { slug: 't5-keyframe-coverage', title: 'keyframe size and strength' }, async (d) => {
    await d.click(layer('Logo · logo'));
    const width = page.getByRole('textbox', { name: 'Width', exact: true });
    const height = page.getByRole('textbox', { name: 'Height', exact: true });
    const start = (await page.getByText('00:00f').first().boundingBox())!;
    const end = (await page.getByText('05:00f').first().boundingBox())!;
    const at = (share: number) => ({ x: start.x + (end.x - start.x) * share, y: start.y + start.height / 2 });
    const setSize = async (w: string, h: string) => {
      for (const [field, value] of [[width, w], [height, h]] as const) {
        await d.click(field);
        await d.key('Meta+A');
        await d.type(field, value, { click: false });
        await d.key('Enter');
      }
    };

    await setSize('140', '140');
    await d.click(at(0.4));
    await setSize('560', '560');
    await d.click(at(0));
    await d.click(page.getByTestId('frame-timeline-play'));
    await d.wait(2600);
    await d.click(page.getByTestId('frame-timeline-play'));
    await d.wait(500);
  });
});
