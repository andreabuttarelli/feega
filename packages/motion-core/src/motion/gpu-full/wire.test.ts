import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DisplayList, Item } from './display-list';
import { itemPack, itemWire, listPack, listWire, packsKnown, spliceWire, wiresKnown, itemKey, stripContours } from './wire';

const bar = (n: number) => ({ kind: 'path', clip: `bar${n}`, contours: [[n, 0, n + 5, 0, n + 5, 5]], paint: { kind: 'solid', color: [1, 0, 0, 1] } }) as unknown as Item;
const face = { family: 'Inter', italic: false, weight: [400, 700], url: 'https://fonts/inter.woff2', ranges: [[0, 255]] };
const listOf = (items: Item[]) => ({ width: 99.2, height: 50.6, background: [1, 1, 1, 1], items, unsupported: [{ clip: 'x', why: 'y' }], faces: [face], bleed: 4 }) as unknown as DisplayList;

const original = JSON.stringify;
let itemsRead = 0;

beforeEach(() => {
  itemsRead = 0;
  JSON.stringify = ((value: unknown, ...rest: unknown[]) => {
    if (value && typeof value === 'object' && 'clip' in value) {
      itemsRead++;
    }
    return (original as (...a: unknown[]) => string)(value, ...rest);
  }) as typeof JSON.stringify;
});

afterEach(() => {
  JSON.stringify = original;
});

describe('the wire to the core', () => {
  it('sends a list as whole pixels, its background, faces and items, and nothing the core never reads', () => {
    const list = listOf([bar(0), bar(1)]);

    expect(JSON.parse(listWire(list))).toEqual({ width: 100, height: 51, background: [1, 1, 1, 1], faces: [face], items: [bar(0), bar(1)] });
  });

  it('sends a list without a background as null', () => {
    const list = { ...listOf([]), background: undefined } as unknown as DisplayList;

    expect(JSON.parse(listWire(list)).background).toBeNull();
  });

  it('sends a splice as its head, tail and new items', () => {
    expect(JSON.parse(spliceWire({ head: 3, tail: 2, items: [bar(7)] }))).toEqual({ head: 3, tail: 2, items: [bar(7)] });
  });

  it('serialises an item once however often it is sent', () => {
    const items = [bar(0), bar(1), bar(2)];

    listWire(listOf(items));
    listWire(listOf(items.slice(1)));
    spliceWire({ head: 0, tail: 0, items });

    expect(itemsRead).toBe(3);
  });

  it('never serialises on this thread an item another thread already wired', () => {
    const items = [bar(0), bar(1)];
    wiresKnown(items, items.map((i) => original(i)));

    expect(JSON.parse(listWire(listOf(items))).items).toEqual(items);
    expect(itemWire(items[1])).toBe(original(items[1]));
    expect(itemsRead).toBe(0);
  });
});

describe('the packed wire to the core', () => {
  it('sends contours as floats beside the json, each item counting its own from zero', () => {
    const packed = listPack(listOf([bar(0), bar(10)]));
    const json = JSON.parse(packed.json);

    expect(json.items.map((i: { contours: number[] }) => i.contours)).toEqual([[0], [0]]);
    expect([...packed.floats]).toEqual([0, 0, 5, 0, 5, 5, 10, 0, 15, 0, 15, 5]);
    expect([...packed.ends]).toEqual([6, 12]);
    expect(json.width).toBe(100);
  });

  it('packs an item once however often it is sent', () => {
    const items = [bar(0), bar(1)];

    listPack(listOf(items));
    listPack(listOf(items));

    expect(itemsRead).toBe(2);
  });

  it('reuses packs made in the worker', () => {
    const items = [bar(0)];
    packsKnown(items, [itemPack(bar(3))]);

    expect([...listPack(listOf(items)).floats]).toEqual([3, 0, 8, 0, 8, 5]);
  });
});

describe('telling items apart without spelling out their contours', () => {
  it('gives items that differ only in contours different keys, and equal ones the same key', () => {
    const [a, b, c] = [bar(0), bar(1), bar(0)];

    expect(itemKey(a)).toBe(itemKey(c));
    expect(itemKey(a)).not.toBe(itemKey(b));
  });

  it('keys an item whose contours arrived as buffers like the same item with arrays', () => {
    const { items } = stripContours([bar(4)]);

    expect(itemKey(items[0])).toBe(itemKey(bar(4)));
  });
});
