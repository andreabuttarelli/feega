import { ItemKind, type DisplayList, type GroupItem, type Item } from './display-list';

export type Splice = { head: number; tail: number; items: Item[] };

const wires = new WeakMap<Item, string>();

const CONTOURS = 'contours';

export type ContourView = { floats: Float64Array; ends: Uint32Array };

const isView = (value: unknown): value is ContourView => !!value && typeof value === 'object' && (value as ContourView).floats instanceof Float64Array;

const contoursOf = (view: ContourView): number[][] => [...view.ends].map((end, i) => Array.from(view.floats.subarray(i ? view.ends[i - 1] : 0, end)));

const expanded = (key: string, value: unknown) => (key === CONTOURS && isView(value) ? contoursOf(value) : value);

export function itemWire(item: Item): string {
  const known = wires.get(item);
  if (known !== undefined) {
    return known;
  }
  const made = JSON.stringify(item, expanded);
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

const viewOfArrays = (contours: number[][]): ContourView => {
  const ends = new Uint32Array(contours.length);
  let at = 0;
  contours.forEach((c, i) => (ends[i] = at += c.length));
  const floats = new Float64Array(at);
  let from = 0;
  contours.forEach((c) => (floats.set(c, from), (from += c.length)));
  return { floats, ends };
};

export function itemPack(item: Item): ItemPack {
  const views: ContourView[] = [];
  let contoursSoFar = 0;
  const json = JSON.stringify(item, (key, value) => {
    if (key !== CONTOURS) {
      return value;
    }
    const view = isView(value) ? value : viewOfArrays(value as number[][]);
    views.push(view);
    const first = contoursSoFar;
    contoursSoFar += view.ends.length;
    return Array.from({ length: view.ends.length }, (_, i) => first + i);
  });
  return { json, ...joined(views) };
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

function joined(parts: readonly ContourView[]): ContourView {
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

const keys = new WeakMap<Item, string>();

function hashOf(floats: Float64Array): string {
  const words = new Uint32Array(floats.buffer, floats.byteOffset, floats.length * 2);
  let hash = 0x811c9dc5;
  for (let i = 0; i < words.length; i++) {
    hash = Math.imul(hash ^ words[i], 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function itemKey(item: Item): string {
  const known = keys.get(item);
  if (known !== undefined) {
    return known;
  }
  const made = item.kind === ItemKind.Group ? groupKey(item) : leafKey(item);
  keys.set(item, made);
  return made;
}

function leafKey(item: Item): string {
  const pack = packOf(item);
  return `${pack.json}#${hashOf(pack.floats)}`;
}

function groupKey(group: GroupItem): string {
  const shell = itemPack({ ...group, items: [] });
  return `${shell.json}#${hashOf(shell.floats)}[${group.items.map(itemKey).join(',')}]`;
}

export function listPack(list: DisplayList): ListPack {
  const parts = list.items.map(packOf);
  const head = `{"width":${Math.ceil(list.width)},"height":${Math.ceil(list.height)},"background":${JSON.stringify(list.background ?? null)},${facesWire(list)}"items":`;
  return { json: `${head}[${parts.map((p) => p.json).join(',')}]}`, ...joined(parts) };
}

type Sizes = { floats: number; ends: number };

function measure(value: unknown, sizes: Sizes): void {
  if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v) => measure(v, sizes));
    return;
  }
  for (const [key, v] of Object.entries(value)) {
    if (key === CONTOURS && Array.isArray(v)) {
      sizes.ends += v.length;
      sizes.floats += (v as number[][]).reduce((n, c) => n + c.length, 0);
      continue;
    }
    measure(v, sizes);
  }
}

type Cursor = { floats: Float64Array; ends: Uint32Array; f: number; e: number };

function viewOf(contours: number[][], at: Cursor): ContourView {
  const [fromF, fromE] = [at.f, at.e];
  for (const contour of contours) {
    at.floats.set(contour, at.f);
    at.f += contour.length;
    at.ends[at.e++] = at.f - fromF;
  }
  return { floats: at.floats.subarray(fromF, at.f), ends: at.ends.subarray(fromE, at.e) };
}

function stripped(value: unknown, at: Cursor): unknown {
  if (!value || typeof value !== 'object' || ArrayBuffer.isView(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => stripped(v, at));
  }
  return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, key === CONTOURS && Array.isArray(v) ? viewOf(v as number[][], at) : stripped(v, at)]));
}

export function stripContours(items: readonly Item[]): { items: Item[]; contours: ContourView } {
  const sizes = { floats: 0, ends: 0 };
  measure(items, sizes);
  const at: Cursor = { floats: new Float64Array(sizes.floats), ends: new Uint32Array(sizes.ends), f: 0, e: 0 };
  return { items: stripped(items, at) as Item[], contours: { floats: at.floats, ends: at.ends } };
}
