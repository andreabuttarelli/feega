import { describe, expect, it } from 'vitest';
import { ItemKind, type Item, type PathItem, type ImageItem } from '$lib/motion/gpu-full/display-list';
import { rgbaOf } from '$lib/motion/gpu-full/rgba';
import { faceOf } from '$lib/canvas/gpu/card-face';
import { NODE_PORTS } from '$lib/canvas/node-ports';
import { CardPart, cardItems, type CoreCard } from './cards';
import type { CoreTheme } from './overlay';
import type { Glyphs } from './chrome';

const theme: CoreTheme = { paper: '#ffffff', panel: '#ffffff', line: '#e5e5e5', ink: '#1d1d1f', inkSoft: '#6e6e73', accent: '#7c5cff', wire: '#b3b3b6', iterate: '#d97706' };
const glyphs: Glyphs = (text, size) => ({ contours: text ? [[0, 0, text.length * size, 0, text.length * size, size, 0, size]] : [], width: text.length * size, height: size });

const box = (contours: number[][]) => {
  const xs = contours.flatMap((c) => c.filter((_, i) => i % 2 === 0));
  const ys = contours.flatMap((c) => c.filter((_, i) => i % 2 === 1));
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => Math.round(v) + 0);
};
const asset = (id: string) => `https://cdn/${id}`;
const card = (kind: string, data: Record<string, unknown>, over: Partial<CoreCard> = {}): CoreCard => ({ id: 'n', x: 0, y: 0, w: 200, h: 100, face: faceOf({ id: 'n', kind }, data, asset), ...over });
const part = (items: Item[], p: CardPart) => items.filter((i) => i.clip === `n:${p}`);
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

  it('lays thumbnails of a source in three square columns', () => {
    const c = { ...card('social_account_feed', { handle: 'x' }), face: { ...faceOf({ id: 'n', kind: 'social_account_feed' }, { handle: 'x' }, asset, ['t1', 't2']) }, w: 300, h: 300 };
    const thumbs = part(cardItems(c, theme, glyphs), CardPart.Thumb).filter((i): i is ImageItem => i.kind === ItemKind.Image);

    expect(thumbs.map((t) => t.src)).toEqual(['t1', 't2']);
    expect(thumbs[0].size.width).toBeCloseTo((300 - 28 - 8) / 3);
  });

  it('moves every item by the card position', () => {
    const [, paper] = paths(cardItems(card('doc', {}, { x: 50, y: 70 }), theme, glyphs), CardPart.Panel);

    expect(box(paper.contours)).toEqual([50, 70, 250, 170]);
  });

  it.each(Object.keys(NODE_PORTS))('draws something for a %s card', (kind) => {
    expect(cardItems(card(kind, {}), theme, glyphs).length).toBeGreaterThan(0);
  });

  it('sets a source title in the bold face', () => {
    const bold: Glyphs = () => ({ contours: [[0, 0, 1, 0, 1, 1]], width: 1, height: 1 });
    const [title] = paths(cardItems(card('iframe', { url: 'x' }), theme, glyphs, bold), CardPart.Title);

    expect(box(title.contours)).toEqual([14, 14, 15, 15]);
  });
});
