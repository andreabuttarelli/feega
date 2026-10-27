import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test, expect, gotoHydrated } from '../../../tests/e2e/fixtures/session';
import { newClip, newMotionDoc, MotionFormat } from '@feega/motion-core/motion/doc';
import { installCursor, recordDemo } from '../record';

const PICTURE = readFileSync('static/og.png');
const ELEMENT_SIDE = 260;
const OUTPUT_PORT = { x: 625, y: 400 };
const IMAGES_INPUT = { x: 875, y: 510 };

test('image output port', async ({ page, session, admin }) => {
  const assetId = randomUUID();
  const elementId = randomUUID();
  const targetId = randomUUID();
  const path = `${session.orgId}/${session.projectId}/${assetId}.png`;

  const stored = await admin.storage.from('canvas-assets').upload(path, PICTURE, { contentType: 'image/png' });
  expect(stored.error).toBeNull();
  await admin.from('assets').insert({ id: assetId, org_id: session.orgId, project_id: session.projectId, type: 'image', source: 'upload', url: path, mime_type: 'image/png' });

  const doc = newMotionDoc(MotionFormat.Landscape);
  doc.assets = [{ id: assetId, kind: 'image', name: 'Studio shot' }];
  doc.tracks[0].clips = [newClip({ id: 'photo', from: 0, durationInFrames: 90, component: 'Image' as never, props: { assetId } })];
  const base = { org_id: session.orgId, project_id: session.projectId, canvas_id: session.canvasId, actor_kind: 'user', actor_id: session.userId };
  await admin.from('nodes').insert([
    { ...base, id: elementId, type: 'element', x: 0, y: 0, width: ELEMENT_SIDE, height: ELEMENT_SIDE, data: { docHeadRevision: 1 } },
    { ...base, id: targetId, type: 'image', x: 520, y: 0, data: { prompt: 'A packshot of this on a marble table' } }
  ]);
  await admin.from('motion_revisions').insert({ org_id: session.orgId, node_id: elementId, version: 1, doc, actor_kind: 'user', actor_id: session.userId });

  await installCursor(page);
  await gotoHydrated(page, `/p/${session.projectId}/c/${session.canvasId}`);
  await page.waitForTimeout(3000);

  await recordDemo(page, { slug: 'image-output-port', title: 'wire any image into a generator' }, async (d) => {
    await d.look({ x: 340, y: 240, width: 940, height: 400 }, 1500);
    await d.drag(OUTPUT_PORT, IMAGES_INPUT);
    await expect.poll(async () => (await admin.from('nodes_connections').select('target_handle').eq('source_node_id', elementId).eq('target_node_id', targetId)).data?.[0]?.target_handle).toBe('images');
    await d.wait(1500);
    await page.screenshot({ path: process.env.PORT_SHOT ?? '/tmp/image-port-wired.png' });
  });
});
