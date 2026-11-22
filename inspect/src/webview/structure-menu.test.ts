import { describe, expect, it } from 'vitest';
import { AddKind, AddPlace } from '@feega/live-edit/add-node';
import { StructureOp } from '@feega/live-edit/structure';
import { WrapTag } from '@feega/live-edit/wrap-node';
import { ADD_ITEMS, COPY_FOR_AGENT, Command, MENU_ITEMS, WRAP_ITEMS, fitMenu, menuFor, pickedOf, submenuSpot, type MenuItem } from './structure-menu';

const VIEW = { width: 1000, height: 900 };

const leaves = (items: MenuItem[]): MenuItem[] => items.flatMap((item) => item.items ?? [item]);

describe('fitMenu', () => {
  it('keeps a menu that fits where it was opened', () => {
    expect(fitMenu({ x: 100, y: 100 }, { width: 160, height: 120 }, VIEW)).toEqual({ x: 100, y: 100 });
  });

  it('lifts a menu that would leave the bottom of the view', () => {
    expect(fitMenu({ x: 100, y: 877 }, { width: 160, height: 120 }, VIEW)).toEqual({ x: 100, y: 772 });
  });

  it('pulls a menu back from the right edge', () => {
    expect(fitMenu({ x: 980, y: 10 }, { width: 160, height: 120 }, VIEW)).toEqual({ x: 832, y: 10 });
  });
});

describe('submenuSpot', () => {
  const MENU = { width: 160, height: 200 };

  it('opens to the right of the row', () => {
    expect(submenuSpot({ left: 100, right: 260, top: 50 }, MENU, VIEW)).toEqual({ x: 260, y: 50 });
  });

  it('opens to the left when the right side is out of view', () => {
    expect(submenuSpot({ left: 700, right: 860, top: 50 }, MENU, VIEW)).toEqual({ x: 540, y: 50 });
  });

  it('is lifted when it would leave the bottom', () => {
    expect(submenuSpot({ left: 100, right: 260, top: 800 }, MENU, VIEW)).toEqual({ x: 260, y: 692 });
  });
});

describe('the one menu table', () => {
  it('offers Add as child with every element kind the Add button offers', () => {
    const add = MENU_ITEMS.find((item) => item.label === 'Add as child');

    expect(add?.items?.map((item) => pickedOf(item.id))).toEqual(ADD_ITEMS.map((item) => ({ command: Command.Add, kind: item.id as AddKind, place: AddPlace.Child })));
  });

  it('offers Wrap with every wrapper tag live-edit supports', () => {
    const wrap = MENU_ITEMS.find((item) => item.label === 'Wrap with');
    const tags = wrap?.items?.map((item) => pickedOf(item.id)).map((picked) => (picked.command === Command.Wrap ? picked.tag : null));

    expect(wrap?.items?.map((item) => item.label)).toEqual(WRAP_ITEMS.map((item) => item.label));
    expect(new Set(tags)).toEqual(new Set(Object.values(WrapTag)));
  });

  it('keeps duplicate, unwrap, delete and copy in the same menu', () => {
    expect(MENU_ITEMS.map((item) => item.id)).toEqual(expect.arrayContaining([COPY_FOR_AGENT, StructureOp.Duplicate, StructureOp.Unwrap, StructureOp.Delete]));
  });

  it('has no two entries with the same id', () => {
    const ids = leaves(MENU_ITEMS).map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('turns an id into a command', () => {
    expect(pickedOf(StructureOp.Delete)).toEqual({ command: Command.Structure, op: StructureOp.Delete });
    expect(pickedOf(COPY_FOR_AGENT)).toEqual({ command: Command.Copy });
    expect(pickedOf('wrap:section')).toEqual({ command: Command.Wrap, tag: WrapTag.Section });
  });
});

describe('menuFor', () => {
  it('keeps the whole menu for one element', () => {
    expect(menuFor(1)).toEqual(MENU_ITEMS);
  });

  it('drops what only makes sense for one element when several are selected', () => {
    const ids = menuFor(3).map((item) => item.id);

    expect(ids).not.toContain('add-child');
    expect(ids).toEqual(expect.arrayContaining([COPY_FOR_AGENT, StructureOp.Duplicate, 'wrap-with', StructureOp.Unwrap, StructureOp.Delete]));
  });
});
