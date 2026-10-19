import type { Use, UsePatch } from '$lib/motion/gpu-full/core-web';
import type { PathItem } from '$lib/motion/gpu-full/display-list';

const same = (a: Use, b: Use) => a.group === b.group && Boolean(a.cache) === Boolean(b.cache) && Boolean(a.hold) === Boolean(b.hold) && a.matrix.every((v, i) => v === b.matrix[i]);

export class SentOverlay {
  #sent: string | null = null;

  changed(items: readonly PathItem[]): boolean {
    const json = JSON.stringify(items);
    const changed = json !== this.#sent;
    this.#sent = json;
    return changed;
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
