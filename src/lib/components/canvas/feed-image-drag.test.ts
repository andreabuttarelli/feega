import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import SocialFeedNode from './SocialFeedNode.svelte';
import ProductsNode from './ProductsNode.svelte';

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), 'utf8');
const page = read('../../../routes/p/[projectId]/c/[canvasId]/+page.svelte');
const flow = read('gpu/GpuFlow.svelte');

const feed = { platform: 'instagram', handle: 'atelier', syncStatus: 'idle', syncError: null } as never;
const shop = { url: 'https://shop.test', syncStatus: 'idle', syncError: null } as never;
const post = { id: 'post-1', caption: 'New drop', media: { type: 'image', thumbnailUrl: 'https://cdn.test/t.jpg', items: [{ type: 'image', url: 'https://cdn.test/f.jpg', thumbnailUrl: 'https://cdn.test/t.jpg' }] } } as never;
const product = { id: 'prod-1', title: 'Linen shirt', price: 89, currency: 'EUR', compareAtPrice: null, images: [{ url: 'https://shop.test/a.jpg' }] } as never;

describe('the thumbnails of a feed or products node', () => {
  it('are draggable and keep the node from moving when the node id is known', () => {
    const body = render(SocialFeedNode, { props: { node: feed, nodeId: 'feed-1', posts: [post], total: 1 } }).body;

    expect(body).toContain('data-testid="feed-image"');
    expect(body).toMatch(/<img[^>]*draggable="true"/);
    expect(body).toMatch(/<img[^>]*class="[^"]*nodrag/);
  });

  it('are draggable for products too', () => {
    const body = render(ProductsNode, { props: { node: shop, nodeId: 'shop-1', products: [product], total: 1 } }).body;

    expect(body).toMatch(/<img[^>]*draggable="true"/);
  });

  it('stay still pictures where the node is only shown, as on a shared canvas', () => {
    const body = render(SocialFeedNode, { props: { node: feed, posts: [post], total: 1 } }).body;

    expect(body).not.toContain('draggable="true"');
  });
});

describe('the drag reaches the canvas', () => {
  it('the page mounts both nodes with their own id', () => {
    expect(page).toMatch(/<SocialFeedNode node=\{feed\} nodeId=\{id\}/);
    expect(page).toMatch(/<ProductsNode node=\{catalog\} nodeId=\{id\}/);
  });

  it('the surface reads the drop and hands it to the page', () => {
    expect(flow).toMatch(/parseFeedImageDrag\(e\.dataTransfer\?\.getData\(CANVAS_DRAG_FEED_IMAGE\)/);
    expect(flow).toMatch(/props\.onDropFeedImage\?\.\(feedImage, at\)/);
    expect(page).toMatch(/onDropFeedImage=\{dropFeedImage\}/);
  });

  it('the page posts the drop to the importFeedImage action', () => {
    expect(page).toMatch(/post\('importFeedImage'/);
  });
});
