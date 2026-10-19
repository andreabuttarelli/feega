import { describe, expect, it } from 'vitest';
import { BlendMode } from '../blend';
import { MaskMode } from '../mask';
import { FillRule, ItemKind, PaintKind, type GroupItem, type PathItem } from './display-list';
import { FilterKind } from './filters';
import { CoverKind } from './mask-layers';
import { ungrouped } from './ungroup';

const shape = (part: Partial<PathItem> = {}): PathItem => ({ kind: ItemKind.Path, clip: 'c', contours: [[0, 0, 1, 0, 1, 1]], rule: FillRule.NonZero, paint: { kind: PaintKind.Solid, color: [0, 0, 0, 1] }, opacity: 0.5, matrix: [1, 0, 0, 1, 0, 0], blur: 1, blend: BlendMode.Normal, ...part });
const mask = { mode: MaskMode.Intersect, invert: false, level: 1, feather: 0, cover: { kind: CoverKind.Path as const, contours: [], matrix: [1, 0, 0, 1, 0, 0] as [number, number, number, number, number, number] } };
const grain = { kind: FilterKind.Css as const, fns: [{ name: 'blur', args: ['1px'] }] };

describe('ungrouped', () => {
  it('hands each item of a group the group look, for a renderer that has no groups', () => {
    const group: GroupItem = { kind: ItemKind.Group, clip: 'c', items: [shape(), shape({ masks: [mask] })], opacity: 0.4, matrix: [1, 0, 0, 1, 0, 0], blur: 2, blend: BlendMode.Multiply, masks: [mask], filters: [grain], space: [1, 0, 0, 1] };

    const items = ungrouped([group]);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ opacity: 0.2, blur: 3, blend: BlendMode.Multiply, masks: [mask], filters: [grain] });
    expect(items[1].masks).toEqual([mask, mask]);
  });

  it('leaves items outside groups as they are', () => {
    const plain = shape();

    expect(ungrouped([plain])).toEqual([plain]);
  });
});
