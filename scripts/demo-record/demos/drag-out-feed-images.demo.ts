import { join } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { test, expect, type E2eSession } from '../../../tests/e2e/fixtures/session';
import { installCursor, recordDemo } from '../record';
import { openCanvas } from './seed';

const PICTURES = join(process.cwd(), 'imgs');
const BUCKET = 'canvas-assets';
const SIGNED_FOR_S = 24 * 3600;
const STORE_URL = 'https://atelier-nord.myshopify.com';
const HANDLE = 'atelier.nord';

const CATALOGUE = [
  { file: 'model-10-tshirt.png', title: 'Linen overshirt', price: 89 },
  { file: 'model-11-sunglasses.png', title: 'Acetate sunglasses', price: 140 },
  { file: 'model-12-sneaker.png', title: 'Court sneaker', price: 120 },
  { file: 'model-07-orange-jacket.png', title: 'Field jacket', price: 215 },
  { file: 'model-09-perfume.png', title: 'Eau de Nord', price: 78 },
  { file: 'model-08-garden-tools.png', title: 'Garden tool set', price: 64 }
];

const FEED = [
  { file: '05-editorial-suit.png', caption: 'The new suit, cut in Porto.' },
  { file: '08-street-fashion.png', caption: 'Street, in the field jacket.' },
  { file: '14-close-portrait.png', caption: 'Frames for the long summer.' },
  { file: '12-orange-athlete.png', caption: 'Orange hour.' },
  { file: '16-orange-creative.png', caption: 'Studio notes, week 43.' },
  { file: '13-flower-hands.png', caption: 'Eau de Nord, now in store.' }
];

async function hosted(admin: SupabaseClient, session: E2eSession, file: string) {
  const bytes = await sharp(join(PICTURES, file)).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
  const path = `${session.orgId}/${session.projectId}/seed/${file.replace(/\.png$/, '.jpg')}`;
  const stored = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  expect(stored.error).toBeNull();
  const signed = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_FOR_S);
  expect(signed.error).toBeNull();
  return { path, url: signed.data!.signedUrl };
}

const tile = (page: import('@playwright/test').Page, nodeId: string) => page.locator(`.gpu-node[data-id="${nodeId}"]`);

test('drag pictures out of feeds and stores', async ({ page, session, admin, seedNode }) => {
  const shop = await seedNode({ type: 'products', x: 0, y: 0, data: { type: 'shopify', url: STORE_URL, limit: 12, sync_status: 'done' } });
  const feed = await seedNode({ type: 'social_account_feed', x: 520, y: 0, data: { platform: 'instagram', handle: HANDLE, limit: 12, sync_status: 'done' } });

  const products = await Promise.all(CATALOGUE.map(async (item, i) => {
    const picture = await hosted(admin, session, item.file);
    return { org_id: session.orgId, project_id: session.projectId, node_id: shop.id, platform: 'shopify', external_id: `sku-${i}`, handle: item.title.toLowerCase().replace(/\W+/g, '-'), title: item.title, price: item.price, currency: 'EUR', url: `${STORE_URL}/products/${i}`, images: [{ url: picture.url }], available: true };
  }));
  const posts = await Promise.all(FEED.map(async (item, i) => {
    const picture = await hosted(admin, session, item.file);
    const items = [{ type: 'image', url: picture.url, thumbnailUrl: picture.url, thumbnailPath: picture.path }];
    return { org_id: session.orgId, project_id: session.projectId, node_id: feed.id, platform: 'instagram', external_id: `ig-${i}`, handle: HANDLE, caption: item.caption, permalink: `https://www.instagram.com/p/atelier-${i}/`, posted_at: new Date(Date.now() - i * 86_400_000).toISOString(), media: { type: 'image', thumbnailUrl: picture.url, items }, metrics: {} };
  }));
  expect((await admin.from('products').insert(products)).error).toBeNull();
  expect((await admin.from('social_posts').insert(posts)).error).toBeNull();

  await installCursor(page);
  await openCanvas(page, session);
  await page.keyboard.press('Meta+Minus');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: process.env.DEMO_SHOT_DIR ? join(process.env.DEMO_SHOT_DIR, 'drag-out-before.png') : 'test-results/drag-out-before.png' });

  const imageNodes = () => admin.from('nodes').select('id, data, width, height, x, y').eq('canvas_id', session.canvasId).eq('type', 'image').is('deleted_at', null);

  await recordDemo(page, { slug: 'drag-out-feed-images', title: 'drag pictures out of feeds' }, async (d) => {
    await d.click(tile(page, shop.id));
    const thumb = tile(page, shop.id).getByTestId('feed-image').nth(3);
    await expect(thumb).toBeVisible({ timeout: 30_000 });
    const surface = (await page.locator('[data-canvas-surface]').boundingBox())!;
    await d.drag(thumb, { x: surface.x + surface.width * 0.3, y: surface.y + surface.height * 0.82 });
    await expect.poll(async () => (await imageNodes()).data?.length, { timeout: 60_000 }).toBe(1);
    await d.wait(1200);

    await d.click(tile(page, feed.id));
    const post = tile(page, feed.id).getByTestId('feed-image').nth(0);
    await expect(post).toBeVisible({ timeout: 30_000 });
    await d.drag(post, { x: surface.x + surface.width * 0.7, y: surface.y + surface.height * 0.82 });
    await expect.poll(async () => (await imageNodes()).data?.length, { timeout: 60_000 }).toBe(2);
    await d.wait(1500);
  });

  const made = (await imageNodes()).data!;
  expect(made.map((n) => (n.data as { source?: { kind?: string } }).source?.kind).sort()).toEqual(['post', 'product']);
  expect(made.every((n) => typeof (n.data as { assetId?: string }).assetId === 'string')).toBe(true);
  await page.screenshot({ path: process.env.DEMO_SHOT_DIR ? join(process.env.DEMO_SHOT_DIR, 'drag-out-after.png') : 'test-results/drag-out-after.png' });

  await page.reload();
  await expect(page.locator('[data-canvas-surface]')).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(3000);
  expect((await imageNodes()).data).toHaveLength(2);
  await page.screenshot({ path: process.env.DEMO_SHOT_DIR ? join(process.env.DEMO_SHOT_DIR, 'drag-out-reloaded.png') : 'test-results/drag-out-reloaded.png' });
});
