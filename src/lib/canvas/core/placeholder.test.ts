import { describe, expect, it } from 'vitest';
import { ItemKind, type DisplayList, type Item } from '$lib/motion/gpu-full/display-list';
import { BlendMode } from '$lib/motion/blend';
import { blankCard, choose, nearestFirst, withoutPictures } from './placeholder';

const theme = { paper: '#ffffff', panel: '#ffffff', line: '#e5e5e5', ink: '#000000', inkSoft: '#666666', accent: '#0000ff', wire: '#999999', iterate: '#999999' };
const view = { x: 0, y: 0, zoom: 1 };
const area = { width: 1000, height: 1000 };

const picture = (clip: string): Item => ({ kind: ItemKind.Image, clip, src: `https://x/${clip}.png`, video: false, mediaTime: 0, size: { width: 40, height: 30 }, fit: 'cover', focus: [0.5, 0.5], zoom: 1, clipped: true, inner: [1, 0, 0, 1, 0, 0], opacity: 1, matrix: [1, 0, 0, 1, 5, 6], blur: 0, blend: BlendMode.Normal });
const listOf = (items: Item[]): DisplayList => ({ width: 100, height: 100, background: null, items, unsupported: [] });
const layer = (id: string, group: string, x = 0) => ({ id, group, box: { x, y: 0, w: 100, h: 100 }, size: { width: 100, height: 100 }, images: 0 });

describe('core placeholders', () => {
  it('a card whose pictures have not arrived draws a block where each picture goes', () => {
    const shown = withoutPictures(listOf([picture('m'), { kind: ItemKind.Group, clip: 'g', items: [picture('n')], opacity: 1, matrix: [1, 0, 0, 1, 0, 0], blur: 0, blend: BlendMode.Normal }]), theme);

    const kinds = (items: Item[]): string[] => items.flatMap((i) => (i.kind === ItemKind.Group ? kinds(i.items) : [i.kind]));
    expect(kinds(shown.items)).toEqual([ItemKind.Path, ItemKind.Path]);
    expect(shown.items[0].matrix).toEqual([1, 0, 0, 1, 5, 6]);
  });

  it('a card keeps the pictures that loaded and blocks only the ones that failed', () => {
    const shown = withoutPictures(listOf([picture('ok'), picture('gone')]), theme, (i) => i.clip === 'gone');

    expect(shown.items.map((i) => i.kind)).toEqual([ItemKind.Image, ItemKind.Path]);
  });

  it('a node with nothing loaded yet still draws a card of its size', () => {
    const blank = blankCard({ x: 10, y: 20, w: 300, h: 200 }, theme);

    expect([blank.width, blank.height]).toEqual([300, 200]);
    expect(blank.items.length).toBeGreaterThan(0);
    expect(blank.items.every((i) => i.kind === ItemKind.Path)).toBe(true);
  });

  it('loads what sits nearest the middle of the screen first', () => {
    const far = { id: 'far', box: { x: 2000, y: 2000, w: 10, h: 10 } };
    const middle = { id: 'middle', box: { x: 495, y: 495, w: 10, h: 10 } };
    const edge = { id: 'edge', box: { x: 0, y: 0, w: 10, h: 10 } };

    expect(nearestFirst([far, edge, middle], view, area).map((n) => n.id)).toEqual(['middle', 'edge', 'far']);
  });

  it('draws the best layer already uploaded, never a hole', () => {
    const chosen = choose([[layer('a', 'a:whole'), layer('a', 'a:blank')]], new Set(['a:blank']), 0);

    expect(chosen.map((l) => l.group)).toEqual(['a:blank']);
  });

  it('spends the upload budget on the nearest nodes and keeps the rest on what they had', () => {
    const near = [layer('near', 'near:whole'), layer('near', 'near:blank')];
    const far = [layer('far', 'far:whole', 5000), layer('far', 'far:blank', 5000)];

    const chosen = choose([near, far], new Set(['near:blank', 'far:blank']), 1);

    expect(chosen.map((l) => l.group)).toEqual(['near:whole', 'far:blank']);
  });

  it('a node with nothing uploaded takes its cheapest layer even past the budget', () => {
    const chosen = choose([[layer('a', 'a:whole'), layer('a', 'a:blank')]], new Set(), 0);

    expect(chosen.map((l) => l.group)).toEqual(['a:blank']);
  });
});
