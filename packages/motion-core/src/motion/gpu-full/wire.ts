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
