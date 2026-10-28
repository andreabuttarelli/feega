import type { Use, UsePatch } from '@feega/motion-core/motion/gpu-full/core-web';
import type { PathItem } from '@feega/motion-core/motion/gpu-full/display-list';
import { OverlayPart } from '@feega/motion-core/motion/gpu-full/core-overlay';
import type { CoreOverlay } from './world-overlay';

const same = (a: Use, b: Use) => a.group === b.group && Boolean(a.cache) === Boolean(b.cache) && Boolean(a.hold) === Boolean(b.hold) && a.matrix.every((v, i) => v === b.matrix[i]);

export class SentOverlay {
  #items: readonly PathItem[] | null = null;
  #read = new WeakMap<PathItem, string>();
  #json: string[] = [];

  waiting(items: readonly PathItem[]): boolean {
    return items !== this.#items;
  }

  changed(items: readonly PathItem[]): boolean {
    if (items === this.#items) {
      return false;
    }
    this.#items = items;
    const json = items.map((item) => this.#jsonOf(item));
    const changed = json.length !== this.#json.length || json.some((j, i) => j !== this.#json[i]);
    this.#json = json;
    return changed;
  }

  #jsonOf(item: PathItem): string {
    const known = this.#read.get(item);
    if (known !== undefined) {
      return known;
    }
    const json = JSON.stringify(item);
    this.#read.set(item, json);
    return json;
  }
}

export class SentParts {
  #parts = new Map(Object.values(OverlayPart).map((p) => [p, new SentOverlay()]));

  waiting(overlay: CoreOverlay): boolean {
    return [...this.#parts].some(([part, sent]) => sent.waiting(overlay[part]));
  }

  changed(overlay: CoreOverlay): OverlayPart[] {
    return [...this.#parts].filter(([part, sent]) => sent.changed(overlay[part])).map(([part]) => part);
  }
}

export class SentUses {
  #sent = new Map<string, Use>();

  patch(next: readonly Use[]): UsePatch | null {
    const wanted = new Set(next.map((u) => u.clip));
    const drop = [...this.#sent.keys()].filter((clip) => !wanted.has(clip));
    const put = next.filter((u) => {
      const old = this.#sent.get(u.clip);
      return !old || !same(old, u);
    });
    const kept = [...this.#sent.keys()].filter((clip) => wanted.has(clip));
    const stacked = [...kept, ...next.filter((u) => !this.#sent.has(u.clip)).map((u) => u.clip)];
    const reordered = stacked.some((clip, i) => clip !== next[i].clip);
    this.#sent = new Map(next.map((u) => [u.clip, u]));
    if (!put.length && !drop.length && !reordered) {
      return null;
    }
    return reordered ? { put, drop, order: next.map((u) => u.clip) } : { put, drop };
  }
}
