import type { Viewport } from '$lib/canvas/dot-grid';
import { toWorld, type Point, type Rect, type Screen } from '$lib/canvas/gpu/camera';

export type Area = { x: number; y: number; w: number; h: number };

const CELL = 1024;

const cellOf = (v: number) => Math.floor(v / CELL);
const keyOf = (cx: number, cy: number) => `${cx},${cy}`;
const contains = (r: Rect, p: Point) => p.x >= r.x && p.y >= r.y && p.x <= r.x + r.w && p.y <= r.y + r.h;
const overlaps = (r: Rect, a: Area) => r.x <= a.x + a.w && r.y <= a.y + a.h && r.x + r.w >= a.x && r.y + r.h >= a.y;

export class SpatialIndex {
  readonly #items: readonly Rect[];
  readonly #cells = new Map<string, number[]>();

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

  within(area: Area): string[] {
    const found = new Set<number>();
    for (let cx = cellOf(area.x); cx <= cellOf(area.x + area.w); cx++) {
      for (let cy = cellOf(area.y); cy <= cellOf(area.y + area.h); cy++) {
        for (const order of this.#cells.get(keyOf(cx, cy)) ?? []) {
          found.add(order);
        }
      }
    }
    return [...found]
      .filter((order) => overlaps(this.#items[order], area))
      .sort((a, b) => a - b)
      .map((order) => this.#items[order].id);
  }

  visible(view: Viewport, screen: Screen): Set<string> {
    const min = toWorld(view, { x: 0, y: 0 });
    const max = toWorld(view, { x: screen.width, y: screen.height });
    return new Set(this.within({ x: min.x, y: min.y, w: max.x - min.x, h: max.y - min.y }));
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
