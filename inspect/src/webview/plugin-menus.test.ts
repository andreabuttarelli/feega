import { describe, expect, it } from 'vitest';
import { Where, type Contribution } from '@feega/plugin-api/manifest';
import { AddPlace } from '@feega/live-edit/add-node';
import { Place } from '@feega/plugin-api/protocol';
import { addMenuItems, contextMenuItems, itemId, parseItemId, pluginDrop } from './plugin-menus';
import type { MenuItem } from './structure-menu';

const BASE: MenuItem[] = [{ id: 'text', label: 'Text' }];

const entry = (plugin: string, e: Contribution) => ({ plugin, entry: e });

describe('itemId', () => {
  it('round-trips plugin and item, even when the item has colons or slashes', () => {
    expect(parseItemId(itemId('feega.object-3d', 'shape:cube'))).toEqual({ plugin: 'feega.object-3d', item: 'shape:cube' });
    expect(parseItemId(itemId('a.b', 'x/y'))).toEqual({ plugin: 'a.b', item: 'x/y' });
  });

  it('does not take a built-in id for a plugin id', () => {
    expect(parseItemId('add-child:text')).toBeNull();
    expect(parseItemId('plugin:nothing')).toBeNull();
  });
});

describe('addMenuItems', () => {
  it('keeps the built-in items untouched when no plugin adds any', () => {
    expect(addMenuItems(BASE, [])).toEqual(BASE);
  });

  it('puts items with a category into one submenu per category', () => {
    const out = addMenuItems(BASE, [
      entry('p', { id: 'cube', title: 'Cube', category: '3D object' }),
      entry('p', { id: 'sphere', title: 'Sphere', category: '3D object' }),
      entry('q', { id: 'other', title: 'Other', category: 'Misc' })
    ]);
    expect(out).toEqual([
      ...BASE,
      { id: 'plugin-category:3D object', label: '3D object', items: [{ id: 'plugin:p/cube', label: 'Cube' }, { id: 'plugin:p/sphere', label: 'Sphere' }] },
      { id: 'plugin-category:Misc', label: 'Misc', items: [{ id: 'plugin:q/other', label: 'Other' }] }
    ]);
  });

  it('adds items without a category at the end of the list', () => {
    expect(addMenuItems(BASE, [entry('p', { id: 'a', title: 'A' })])).toEqual([...BASE, { id: 'plugin:p/a', label: 'A' }]);
  });
});

describe('contextMenuItems', () => {
  const all = [
    entry('p', { id: 'l', title: 'Only layers', where: Where.Layers }),
    entry('p', { id: 'v', title: 'Only preview', where: Where.Preview }),
    entry('p', { id: 'b', title: 'Both', where: Where.Both })
  ];

  it('offers each place only the items made for it', () => {
    expect(contextMenuItems(BASE, all, Where.Layers).map((i) => i.label)).toEqual(['Text', 'Only layers', 'Both']);
    expect(contextMenuItems(BASE, all, Where.Preview).map((i) => i.label)).toEqual(['Text', 'Only preview', 'Both']);
  });
});

describe('pluginDrop', () => {
  const target = { file: 'src/App.svelte', line: 4, col: 3 };

  it('turns a dragged plugin item into a menu signal for the element under the pointer', () => {
    expect(pluginDrop(itemId('feega.object-3d', 'shape:cube'), { target, place: AddPlace.After })).toEqual({ plugin: 'feega.object-3d', item: 'shape:cube', target, place: Place.After });
  });

  it.each([[AddPlace.Child, Place.Child], [AddPlace.Before, Place.Before], [AddPlace.After, Place.After], [AddPlace.Auto, Place.Auto]])('maps %s to %s', (place, expected) => {
    expect(pluginDrop(itemId('p', 'i'), { target, place })?.place).toBe(expected);
  });

  it('leaves built-in items alone', () => {
    expect(pluginDrop('text', { target, place: AddPlace.After })).toBeNull();
  });
});
