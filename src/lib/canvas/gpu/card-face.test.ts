import { describe, expect, it } from 'vitest';
import { Surface, faceOf, handedToCore } from './card-face';
import { PosterSource } from '../poster-lod';
import { NODE_KIND_LABEL, NameTag } from '../node-label';

const asset = (id: string) => `/a/${id}`;

describe('faceOf — what a GPU card draws, one row per node type', () => {
  it('a generated image shows its output, else its prompt waiting to run', () => {
    const done = faceOf({ id: 'i', kind: 'image', tag: NameTag.Shown, poster: { url: '/a/out?w=256', source: PosterSource.Image } }, { prompt: 'a cat', model: 'flux', refId: 'out' }, asset);
    expect(done).toMatchObject({ surface: Surface.Generate, label: NODE_KIND_LABEL.image, media: { url: '/a/out', video: false }, prompt: 'a cat', model: 'flux' });

    const idle = faceOf({ id: 'i', kind: 'image', tag: NameTag.Shown }, { prompt: '' }, asset);
    expect(idle).toMatchObject({ surface: Surface.Generate, media: null, prompt: '' });
  });

  it('a running generation says so', () => {
    expect(faceOf({ id: 'v', kind: 'video', tag: NameTag.Shown }, { prompt: 'x', running: true }, asset).running).toBe(true);
  });

  it('a video output is a video, not an image', () => {
    expect(faceOf({ id: 'v', kind: 'video', tag: NameTag.Shown }, { prompt: 'x', refId: 'r' }, asset).media).toEqual({ url: '/a/r', video: true });
  });

  it('a motion frame draws its poster and, when rendered, its mp4', () => {
    const face = faceOf({ id: 'm', kind: 'motion', tag: NameTag.Shown, poster: { url: '/a/p', source: PosterSource.Image } }, { lastRenderAssetId: 'mp4' }, asset);
    expect(face).toMatchObject({ surface: Surface.Frame, media: { url: '/a/p', video: false }, live: '/a/mp4' });
  });

  it('a free element has no label and no card chrome', () => {
    const face = faceOf({ id: 'e', kind: 'motion', tag: NameTag.Hidden, poster: { url: '/a/p', source: PosterSource.Image } }, { kind: 'element' }, asset);
    expect(face).toMatchObject({ surface: Surface.Graphic, label: null });
  });

  it('a document shows its text, a display name wins over the type label', () => {
    expect(faceOf({ id: 'd', kind: 'doc', tag: NameTag.Shown, displayName: 'Brief' }, { content: '# Hi\nthere' }, asset)).toMatchObject({ surface: Surface.Doc, label: 'Brief', text: '# Hi\nthere', pills: ['Read', 'Write'], count: 'Public link' });
  });

  it('an iframe carries its mode, its address, and what to say when there is none or it is refused', () => {
    const frame = (data: Record<string, unknown>) => faceOf({ id: 'w', kind: 'iframe', tag: NameTag.Shown }, data, asset).embed;

    expect(frame({ url: 'https://x.co' })).toMatchObject({ mode: 'url', url: 'https://x.co', hint: null });
    expect(frame({})).toMatchObject({ mode: 'url', hint: 'Paste an address' });
    expect(frame({ url: 'ftp://x.co' })?.hint).toBe('Only http and https addresses can be embedded');
    expect(frame({ html: '<b>x</b>' })).toMatchObject({ mode: 'html', code: '<b>x</b>', hint: null });
  });

  it('an unknown kind falls back to a plain card, never throws', () => {
    expect(faceOf({ id: 'z', tag: NameTag.Shown }, {}, asset)).toMatchObject({ surface: Surface.Blank, label: null });
  });

  it('a feed carries its tiles, its title and how many it shows of how many it has', () => {
    const tile = (thumb: string) => ({ thumb, caption: null, badge: null, sale: null });
    const face = faceOf({ id: 'f', kind: 'social_account_feed', tag: NameTag.Shown }, { platform: 'tiktok', handle: 'nike' }, asset, { source: { tiles: [tile('t1'), tile('t2')], total: 5, name: null } });

    expect(face).toMatchObject({ surface: Surface.Preview, title: '@nike · tiktok', count: '2/5', error: null });
    expect(face.tiles.map((t) => t.thumb)).toEqual(['t1', 't2']);
    expect(faceOf({ id: 'd', kind: 'doc', tag: NameTag.Shown }, { content: '' }, asset).tiles).toEqual([]);
  });

  it('a source says what it waits for, syncs, or failed at', () => {
    const feed = (data: Record<string, unknown>, total = 0) => faceOf({ id: 'f', kind: 'social_account_feed' }, data, asset, { source: { tiles: [], total, name: null } });
    const store = (data: Record<string, unknown>) => faceOf({ id: 'p', kind: 'products' }, data, asset);

    expect(feed({})).toMatchObject({ title: 'Feed social', empty: 'Select the node to choose the account.' });
    expect(feed({ handle: 'a' }).empty).toBe('No posts yet. Select the node to sync.');
    expect(feed({ handle: 'a' }, 4).empty).toBe('No results with these filters.');
    expect(feed({ handle: 'a', sync_status: 'running' }).count).toBe('syncing…');
    expect(feed({ handle: 'a', sync_status: 'failed', sync_error: 'rate limited' }).error).toBe('rate limited');
    expect(store({ url: 'https://shop.example.com/' })).toMatchObject({ title: 'shop.example.com', empty: 'No products yet. Select the node to sync.' });
    expect(store({})).toMatchObject({ title: 'Products', empty: 'Select the node to enter the store address.' });
  });

  it('kinds the default canvas draws as an empty node carry their name and what they wait for', () => {
    expect(faceOf({ id: 'a', kind: 'ads' }, { page_name: 'x' }, asset)).toMatchObject({ surface: Surface.Empty, title: 'Ads', subtitle: 'Search a brand or a keyword to see its ads.' });
    expect(faceOf({ id: 'c', kind: 'calendar' }, {}, asset)).toMatchObject({ surface: Surface.Empty, title: 'Calendar' });
    expect(faceOf({ id: 'p', kind: 'social_post_mockup' }, { general: { caption: 'x' } }, asset)).toMatchObject({ surface: Surface.Empty, title: 'Post preview' });
    expect(faceOf({ id: 's', kind: 'studio_batch' }, {}, asset)).toMatchObject({ surface: Surface.Pick, title: 'Open Photo studio' });
  });

  it('an influencer carries its name, its cover and its number of views', () => {
    const face = faceOf({ id: 'i', kind: 'influencer' }, {}, asset, { source: { tiles: [{ thumb: 'a', caption: null, badge: null, sale: null }, { thumb: 'b', caption: null, badge: null, sale: null }], total: 2, name: 'Giulia' } });

    expect(face).toMatchObject({ surface: Surface.Person, title: 'Giulia', count: '2' });
    expect(face.tiles.map((t) => t.thumb)).toEqual(['a']);
  });
});

describe('a face the core draws', () => {
  it('drops its poster and live media, so Pixi holds no texture for it', () => {
    const face = faceOf({ id: 'f', kind: 'motion', poster: { url: 'p.jpg' } as never }, {}, (id) => id);
    expect(handedToCore(face)).toMatchObject({ media: null, live: null, surface: face.surface });
  });

  it('a list shows one row per item, with its thumbnail when it holds images', () => {
    const face = faceOf({ id: 'l', kind: 'list' }, { itemKind: 'image', items: [{ url: 'u1', status: 'done' }, { asset_id: 'a2', label: 'Two' }] }, asset);

    expect(face).toMatchObject({ surface: Surface.List, pills: ['Images'], count: '2' });
    expect(face.rows).toEqual([
      { lead: '1', text: '1', thumb: 'u1', status: 'done' },
      { lead: '2', text: 'Two', thumb: asset('a2'), status: null }
    ]);
  });
});
