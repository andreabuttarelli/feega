import { describe, expect, it } from 'vitest';
import { ItemKind, type Item, type PathItem, type ImageItem } from '$lib/motion/gpu-full/display-list';
import { rgbaOf } from '$lib/motion/gpu-full/rgba';
import { faceOf } from '$lib/canvas/gpu/card-face';
import { NODE_PORTS } from '$lib/canvas/node-ports';
import { CardPart, cardItems, type CoreCard } from './cards';
import type { CardIcons } from './card-kit';
import { TileBadge } from '$lib/canvas/source-thumbs';
import { SelectBody, batchOf, type NodeView } from '$lib/canvas/node-view';
import type { CoreTheme } from './overlay';
import type { Glyphs } from './chrome';

const theme: CoreTheme = { paper: '#ffffff', panel: '#ffffff', paper2: '#f9f9f9', line: '#e5e5e5', line2: '#d2d2d7', chip: '#f2f2f2', chipInk: '#141414', ink: '#1d1d1f', inkSoft: '#6e6e73', accent: '#7c5cff', wire: '#b3b3b6', iterate: '#d97706' };
const glyphs: Glyphs = (text, size) => ({ contours: text ? [[0, 0, text.length * size, 0, text.length * size, size, 0, size]] : [], width: text.length * size, height: size });

const box = (contours: number[][]) => {
  const xs = contours.flatMap((c) => c.filter((_, i) => i % 2 === 0));
  const ys = contours.flatMap((c) => c.filter((_, i) => i % 2 === 1));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v) + 0);
};
const asset = (id: string) => `https://cdn/${id}`;
const view = (thumbs: string[], total = thumbs.length): NodeView => ({ source: { tiles: thumbs.map((thumb) => ({ thumb, caption: null, badge: null, sale: null })), total, name: null } });
const icons: CardIcons = { references: [], credit: [], head: new Map(), badge: new Map(), layers: [[0, 0, 5, 0, 5, 5]], play: [[0, 0, 5, 0, 5, 5]], person: [], ui: { open: [], left: [], right: [], help: [], plus: [], image: [], camera: [] } };
const card = (kind: string, data: Record<string, unknown>, over: Partial<CoreCard> = {}): CoreCard => ({ id: 'n', x: 0, y: 0, w: 200, h: 100, face: faceOf({ id: 'n', kind }, data, asset), ...over });
const part = (items: Item[], p: CardPart) => items.filter((i) => i.clip === `n:${p}` || i.clip.startsWith(`n:${p}:`));
const paths = (items: Item[], p: CardPart) => part(items, p) as PathItem[];

describe('cardItems', () => {
  it('draws a raised paper panel with a 1px line border for a doc', () => {
    const items = cardItems(card('doc', { content: 'hi' }), theme, glyphs);
    const [shadow, paper, border] = paths(items, CardPart.Panel);

    expect(box(shadow.contours)).toEqual([0, 2, 200, 102]);
    expect(shadow.opacity).toBe(0.06);
    expect(paper.paint).toEqual({ kind: 'solid', color: rgbaOf(theme.paper) });
    expect(box(border.contours)).toEqual([0, 0, 200, 100]);
    expect(paths(items, CardPart.Body)).toHaveLength(1);
  });

  it('contains an uploaded image in the whole card', () => {
    const [img] = part(cardItems(card('image', { assetId: 'a1', source: 'upload' }), theme, glyphs), CardPart.Media) as ImageItem[];

    expect(img.kind).toBe(ItemKind.Image);
    expect(img.src).toBe('https://cdn/a1');
    expect(img.fit).toBe('contain');
    expect(img.size).toEqual({ width: 200, height: 100 });
  });

  it('gives a generate card a footer with a status dot coloured by state', () => {
    const idle = paths(cardItems(card('image', { prompt: 'a cat' }), theme, glyphs), CardPart.Status)[0];
    const failed = paths(cardItems(card('image', { error: 'boom' }), theme, glyphs), CardPart.Status)[0];

    expect(box(idle.contours)).toEqual([10, 80, 18, 88]);
    expect(idle.paint).toEqual({ kind: 'solid', color: rgbaOf(theme.line) });
    expect(failed.paint).toEqual({ kind: 'solid', color: rgbaOf('#c0392b') });
  });

  it('covers a generated output above the footer', () => {
    const [img] = part(cardItems(card('image', { output_asset_id: 'o1' }), theme, glyphs), CardPart.Media) as ImageItem[];

    expect(img.fit).toBe('cover');
    expect(img.size.height).toBeCloseTo(100 - 13 * 2.4 - 1);
  });

  it('fills a frame stage black', () => {
    const [stage] = paths(cardItems(card('motion', { kind: 'frame' }), theme, glyphs), CardPart.Stage);

    expect(stage.paint).toEqual({ kind: 'solid', color: rgbaOf('#000000') });
  });

  it('lays thumbnails of a source in three square columns under the header', () => {
    const c = { ...card('social_account_feed', { handle: 'x' }), face: faceOf({ id: 'n', kind: 'social_account_feed' }, { handle: 'x' }, asset, view(['t1', 't2'])), w: 300, h: 300 };
    const thumbs = part(cardItems(c, theme, glyphs), CardPart.Thumb).filter((i): i is ImageItem => i.kind === ItemKind.Image);

    expect(thumbs.map((t) => t.src)).toEqual(['t1', 't2']);
    expect(thumbs.map((t) => t.matrix[4])).toEqual([6, 6 + (300 - 20) / 3 + 4]);
    expect(thumbs.map((t) => t.matrix[5])).toEqual([37, 37]);
    expect(thumbs[0].size.width).toBeCloseTo((300 - 20) / 3);
    expect(thumbs[0].size.height).toBeCloseTo(thumbs[0].size.width);
  });

  it('puts a rule under the header and the count at its right edge', () => {
    const c = { ...card('products', { url: 'shop.io' }), face: faceOf({ id: 'n', kind: 'products' }, { url: 'shop.io' }, asset, view(['t1'], 9)), w: 300, h: 300 };
    const [rule] = paths(cardItems(c, theme, glyphs), CardPart.Head).slice(-1);
    const [count] = paths(cardItems(c, theme, glyphs), CardPart.Head).filter((p) => p !== rule);

    expect(box(rule.contours)).toEqual([0, 30, 300, 31]);
    expect(box(count.contours)[2]).toBe(291);
  });

  it('marks a tile with its badge, its sale and its caption only when the whole tile shows', () => {
    const tile = { thumb: 't', caption: '9.00 EUR', badge: TileBadge.Carousel, sale: '−20%' };
    const draw = (h: number) => cardItems({ ...card('products', { url: 'x' }), face: faceOf({ id: 'n', kind: 'products' }, { url: 'x' }, asset, { source: { tiles: [tile], total: 1, name: null } }), w: 300, h }, theme, glyphs, glyphs, icons);

    expect(paths(draw(300), CardPart.Badge)).toHaveLength(2);
    expect(paths(draw(300), CardPart.Sale)).toHaveLength(2);
    expect(paths(draw(300), CardPart.Caption)).toHaveLength(2);
    expect(paths(draw(80), CardPart.Caption)).toHaveLength(0);
  });

  it('shows the failure instead of the grid when the sync failed', () => {
    const f = faceOf({ id: 'n', kind: 'products' }, { url: 'x', sync_status: 'failed', sync_error: 'boom' }, asset, view(['t1']));
    const items = cardItems({ ...card('products', {}), face: f, w: 300, h: 300 }, theme, glyphs);

    expect(part(items, CardPart.Thumb)).toHaveLength(0);
    expect(part(items, CardPart.Empty)).toHaveLength(1);
  });

  it('draws a kind with nothing to show as a dashed card with a badge, its name and what it waits for', () => {
    const c = { ...card('ads', {}), w: 300, h: 200 };
    const items = cardItems(c, theme, glyphs, glyphs, { ...icons, badge: new Map([['ads', [[0, 0, 4, 0, 4, 4]]]]) });

    expect(paths(items, CardPart.Panel)[1].contours.length).toBeGreaterThan(10);
    expect(box(paths(items, CardPart.Badge)[0].contours)).toEqual([130, 38, 170, 78]);
    expect(paths(items, CardPart.Title)).toHaveLength(1);
    expect(paths(items, CardPart.Empty)).toHaveLength(3);
  });

  it('wraps the hint of an empty card in lines no wider than 28 characters, each centred', () => {
    const c = { ...card('calendar', {}), w: 600, h: 300 };
    const rows = paths(cardItems(c, theme, glyphs), CardPart.Empty);

    expect(rows.length).toBeGreaterThan(1);
    rows.forEach((r) => expect(box(r.contours)[0] + box(r.contours)[2]).toBeCloseTo(600, -1));
  });

  it('draws the studio batch pick state as an icon over an underlined link', () => {
    const c = { ...card('studio_batch', {}), w: 300, h: 200 };
    const items = cardItems(c, theme, glyphs, glyphs, { ...icons, badge: new Map([['studio_batch', [[0, 0, 4, 0, 4, 4]]]]) });

    expect(paths(items, CardPart.Badge)).toHaveLength(1);
    expect(paths(items, CardPart.Empty)).toHaveLength(2);
  });

  it('draws an embedded page as a mode switch and an address field over a blank page', () => {
    const items = cardItems({ ...card('iframe', { url: 'https://x.co' }), w: 480, h: 360 }, theme, glyphs, glyphs, icons);

    expect(paths(items, CardPart.Field)).toHaveLength(3);
    expect(paths(items, CardPart.Head).length).toBeGreaterThan(3);
    expect(paths(items, CardPart.Empty)).toHaveLength(0);
    expect(paths(items, CardPart.Footer)).toHaveLength(2);
  });

  it('asks for an address when an embedded page has none, and shows its code box in code mode', () => {
    expect(paths(cardItems({ ...card('iframe', {}), w: 480, h: 360 }, theme, glyphs), CardPart.Empty)).toHaveLength(1);
    const code = cardItems({ ...card('iframe', { html: '<b>x</b>' }), w: 480, h: 360 }, theme, glyphs);

    expect(paths(code, CardPart.Code)).toHaveLength(3);
    expect(paths(code, CardPart.Button).length).toBeGreaterThan(1);
  });

  it('draws a select as navigation, its current photo and one row per output', () => {
    const view: NodeView = { select: { index: 2, total: 5, body: SelectBody.Photo, text: '', url: 'p.jpg', canAdd: true, rows: [{ color: '#16a34a', label: 'Images', value: '1 file', thumb: 't.jpg', flagged: false }, { color: '#2563eb', label: 'Text', value: '—', thumb: null, flagged: false }] } };
    const items = cardItems({ ...card('select', { index: 2 }), face: faceOf({ id: 'n', kind: 'select' }, { index: 2 }, asset, view), w: 320, h: 300 }, theme, glyphs, glyphs, icons);

    expect((part(items, CardPart.Media) as ImageItem[])[0].fit).toBe('cover');
    expect(part(items, CardPart.Row).length).toBeGreaterThanOrEqual(2);
    expect((part(items, CardPart.Thumb) as ImageItem[])[0].src).toBe('t.jpg');
    expect(paths(items, CardPart.Button).length).toBeGreaterThan(1);
  });

  it('draws effects as the picture, a Not applied tag and an Open editor button, or a prompt without input', () => {
    const view: NodeView = { media: { url: 'e.jpg', kind: 'image' } };
    const items = cardItems({ ...card('effects', {}), face: faceOf({ id: 'n', kind: 'effects' }, {}, asset, view), w: 300, h: 300 }, theme, glyphs);

    expect((part(items, CardPart.Media) as ImageItem[])[0].fit).toBe('contain');
    expect(paths(items, CardPart.Badge)).toHaveLength(2);
    expect(paths(items, CardPart.Button).length).toBeGreaterThan(1);
    expect(paths(cardItems({ ...card('effects', {}), w: 300, h: 300 }, theme, glyphs), CardPart.Empty)).toHaveLength(1);
  });

  it('draws a picked studio batch as a thumbnail grid over its counts', () => {
    const view: NodeView = { batch: batchOf({ approved: 3, done: 5, total: 8, running: 1, failed: 0, thumbs: ['a', 'b', 'c', 'd'] }) };
    const items = cardItems({ ...card('studio_batch', {}), face: faceOf({ id: 'n', kind: 'studio_batch' }, {}, asset, view), w: 300, h: 300 }, theme, glyphs);

    expect((part(items, CardPart.Thumb) as ImageItem[]).filter((i) => i.kind === ItemKind.Image).map((i) => i.src)).toEqual(['a', 'b', 'c', 'd']);
    expect(paths(items, CardPart.Footer).length).toBeGreaterThan(1);
  });

  it('draws an influencer as a cover over a name and views band', () => {
    const f = faceOf({ id: 'n', kind: 'influencer' }, {}, asset, { source: { tiles: [{ thumb: 'face', caption: null, badge: null, sale: null }], total: 1, name: 'Giulia' } });
    const items = cardItems({ ...card('influencer', {}), face: f, w: 200, h: 200 }, theme, glyphs);
    const [cover] = part(items, CardPart.Media) as ImageItem[];
    const [rule] = paths(items, CardPart.Info);

    expect(cover.fit).toBe('cover');
    expect(box(rule.contours)[1]).toBe(148);
    expect(paths(items, CardPart.Subtitle)).toHaveLength(1);
  });

  it('moves every item by the card position', () => {
    const [, paper] = paths(cardItems(card('doc', {}, { x: 50, y: 70 }), theme, glyphs), CardPart.Panel);

    expect(box(paper.contours)).toEqual([50, 70, 250, 170]);
  });

  it.each(Object.keys(NODE_PORTS))('draws something for a %s card', (kind) => {
    expect(cardItems(card(kind, {}), theme, glyphs).length).toBeGreaterThan(0);
  });

  it('sets a title in the bold face', () => {
    const bold: Glyphs = () => ({ contours: [[0, 0, 1, 0, 1, 1]], width: 1, height: 1 });
    const [title] = paths(cardItems(card('ads', {}), theme, glyphs, bold), CardPart.Title);

    expect(box(title.contours)[2] - box(title.contours)[0]).toBe(1);
  });

  it('gives each picture its own clip, since the engine keys textures by clip', () => {
    const c = { ...card('social_account_feed', {}), face: faceOf({ id: 'n', kind: 'social_account_feed' }, {}, asset, view(['t1', 't2', 't3'])), w: 300, h: 300 };
    const clips = cardItems(c, theme, glyphs).filter((i) => i.kind === ItemKind.Image).map((i) => i.clip);

    expect(new Set(clips).size).toBe(3);
  });

  it('clips body text to the card', () => {
    const [body] = paths(cardItems(card('doc', { content: 'x'.repeat(500) }, { x: 10, y: 20 }), theme, glyphs), CardPart.Body);

    expect(body.scissor).toEqual([10, 20, 210, 120]);
  });

  it('draws a list as a header with its count and one row per item that fits', () => {
    const items = cardItems(card('list', { itemKind: 'text', items: [{ text: 'one' }, { text: 'two' }, { text: 'three' }, { text: 'four' }, { text: 'five' }] }, { h: 120 }), theme, glyphs);

    expect(paths(items, CardPart.Head).length).toBeGreaterThan(1);
    expect(new Set(paths(items, CardPart.Row).map((r) => r.clip))).toEqual(new Set(['n:row']));
    expect(paths(items, CardPart.Row)).toHaveLength(4);
  });

  it('puts a thumbnail and a status dot on an image list row', () => {
    const items = cardItems(card('list', { itemKind: 'image', items: [{ url: 'u1', status: 'done' }] }, { h: 120 }), theme, glyphs);

    expect((part(items, CardPart.Thumb) as ImageItem[]).some((i) => i.kind === ItemKind.Image && i.src === 'u1')).toBe(true);
    expect(paths(items, CardPart.Status)).toHaveLength(1);
  });

  it('never draws a snapshot of a node: the card is always its own vectors', () => {
    const items = cardItems(card('doc', { content: 'hi' }), theme, glyphs);

    expect(items.every((i) => i.kind !== ItemKind.Image)).toBe(true);
  });
});
