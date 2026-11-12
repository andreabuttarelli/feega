import type { Viewport } from '$lib/canvas/dot-grid';
import { toWorld, type Point, type Rect, type Screen } from '$lib/canvas/gpu/camera';

export type Area = { x: number; y: number; w: number; h: number };
type CellRange = { x0: number; y0: number; x1: number; y1: number };

const CELL = 1024;

const cellOf = (v: number) => Math.floor(v / CELL);
const ROW = 2 ** 26;

const keyOf = (cx: number, cy: number) => cx * ROW + cy;
const contains = (r: Rect, p: Point) => p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h;
const overlaps = (r: Rect, a: Area) => r.x <= a.x + a.w && r.y <= a.y + a.h && r.x + r.w >= a.x && r.y + r.h >= a.y;

export class SpatialIndex {
  readonly #items: readonly Rect[];
  readonly #cells = new Map<number, number[]>();
  #lastRange: { key: string; orders: readonly number[] } | null = null;

  constructor(items: readonly Rect[]) {
    this.#items = items;
    items.forEach((r, order) => this.#insert(r, order));
  }

  topAt(p: Point): string | null {
    const bucket = this.#cells.get(keyOf(cellOf(p.x), cellOf(p.y))) ?? [];
    for (let i = bucket.length - 1; i >= 0; i--) {
      const r = this.#items[bucket[i]];
      if (contains(r, p)) {
        return r.id;
      }
    }
    return null;
  }

  allAt(p: Point): string[] {
    const bucket = this.#cells.get(keyOf(cellOf(p.x), cellOf(p.y))) ?? [];
    const under = bucket.map((order) => this.#items[order]).filter((r) => contains(r, p));
    return [...new Set(under.reverse().map((r) => r.id))];
  }

  within(area: Area): string[] {
    return this.#candidates(area)
      .filter((order) => overlaps(this.#items[order], area))
      .map((order) => this.#items[order].id);
  }

  visible(view: Viewport, screen: Screen): Set<string> {
    const min = toWorld(view, { x: 0, y: 0 });
    const max = toWorld(view, { x: screen.width, y: screen.height });
    return new Set(this.within({ x: min.x, y: min.y, w: max.x - min.x, h: max.y - min.y }));
  }

  #candidates(area: Area): readonly number[] {
    const range = { x0: cellOf(area.x), y0: cellOf(area.y), x1: cellOf(area.x + area.w), y1: cellOf(area.y + area.h) };
    const key = `${range.x0},${range.y0},${range.x1},${range.y1}`;
    if (this.#lastRange?.key === key) {
      return this.#lastRange.orders;
    }
    const orders = this.#ordersIn(range);
    this.#lastRange = { key, orders };
    return orders;
  }

  #ordersIn({ x0, y0, x1, y1 }: CellRange): number[] {
    if ((x1 - x0 + 1) * (y1 - y0 + 1) > this.#items.length) {
      return this.#items.map((_, order) => order);
    }
    const found = new Set<number>();
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        for (const order of this.#cells.get(keyOf(cx, cy)) ?? []) {
          found.add(order);
        }
      }
    }
    return [...found].sort((a, b) => a - b);
  }

  #insert(r: Rect, order: number) {
    for (let cx = cellOf(r.x); cx <= cellOf(r.x + r.w); cx++) {
      for (let cy = cellOf(r.y); cy <= cellOf(r.y + r.h); cy++) {
        const key = keyOf(cx, cy);
        const bucket = this.#cells.get(key);
        if (bucket) {
          bucket.push(order);
          continue;
        }
        this.#cells.set(key, [order]);
      }
    }
  }
}
