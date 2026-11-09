import type { DisplayList, Item } from './display-list';

export type Splice = { head: number; tail: number; items: Item[] };

const wires = new WeakMap<Item, string>();

export function itemWire(item: Item): string {
  const known = wires.get(item);
  if (known !== undefined) {
    return known;
  }
  const made = JSON.stringify(item);
  wires.set(item, made);
  return made;
}

export function wiresKnown(items: readonly Item[], known: readonly string[]): void {
  items.forEach((item, i) => wires.set(item, known[i]));
}

const itemsWire = (items: readonly Item[]) => `[${items.map(itemWire).join(',')}]`;

const facesWire = (list: DisplayList) => (list.faces ? `"faces":${JSON.stringify(list.faces)},` : '');

export const listWire = (list: DisplayList): string => `{"width":${Math.ceil(list.width)},"height":${Math.ceil(list.height)},"background":${JSON.stringify(list.background ?? null)},${facesWire(list)}"items":${itemsWire(list.items)}}`;

export const spliceWire = (splice: Splice): string => `{"head":${splice.head},"tail":${splice.tail},"items":${itemsWire(splice.items)}}`;

export type ItemPack = { json: string; floats: Float64Array; ends: Uint32Array };
export type ListPack = ItemPack;

const packs = new WeakMap<Item, ItemPack>();

export function itemPack(item: Item): ItemPack {
  const floats: number[] = [];
  const ends: number[] = [];
  const json = JSON.stringify(item, (key, value) => {
    if (key !== 'contours') {
      return value;
    }
    return (value as number[][]).map((contour) => {
      contour.forEach((n) => floats.push(n));
      ends.push(floats.length);
      return ends.length - 1;
    });
  });
  return { json, floats: Float64Array.from(floats), ends: Uint32Array.from(ends) };
}

function packOf(item: Item): ItemPack {
  const known = packs.get(item);
  if (known) {
    return known;
  }
  const made = itemPack(item);
  packs.set(item, made);
  return made;
}

export function packsKnown(items: readonly Item[], known: readonly ItemPack[]): void {
  items.forEach((item, i) => packs.set(item, known[i]));
}

function joined(parts: readonly ItemPack[]): Omit<ItemPack, 'json'> {
  const floats = new Float64Array(parts.reduce((n, p) => n + p.floats.length, 0));
  const ends = new Uint32Array(parts.reduce((n, p) => n + p.ends.length, 0));
  let f = 0;
  let e = 0;
  for (const part of parts) {
    floats.set(part.floats, f);
    part.ends.forEach((end) => (ends[e++] = end + f));
    f += part.floats.length;
  }
  return { floats, ends };
}

export function listPack(list: DisplayList): ListPack {
  const parts = list.items.map(packOf);
  const head = `{"width":${Math.ceil(list.width)},"height":${Math.ceil(list.height)},"background":${JSON.stringify(list.background ?? null)},${facesWire(list)}"items":`;
  return { json: `${head}[${parts.map((p) => p.json).join(',')}]}`, ...joined(parts) };
}
