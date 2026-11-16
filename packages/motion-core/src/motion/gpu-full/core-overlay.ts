import type { PathItem } from './display-list';

export enum OverlayPart {
  Fixed = 'fixed',
  Selected = 'selected',
  Live = 'live'
}

export type OverlayChunk = { key: string; items: readonly PathItem[] };

export type KeyedOverlay = { fixed: readonly OverlayChunk[]; selected: readonly OverlayChunk[] };

export type ChunkOps = { put: [string, readonly PathItem[]][]; drop: string[]; fixed?: string[]; selected?: string[] };

type KeyedPart = OverlayPart.Fixed | OverlayPart.Selected;

const KEYED_PARTS: readonly KeyedPart[] = [OverlayPart.Fixed, OverlayPart.Selected];

const sameKeys = (a: readonly string[] | undefined, b: readonly string[]) => a !== undefined && a.length === b.length && a.every((k, i) => k === b[i]);

export class ChunkSender {
  #sent = new Map<string, readonly PathItem[]>();
  #orders: Partial<Record<KeyedPart, string[]>> = {};

  ops(overlay: KeyedOverlay): ChunkOps | null {
    const chunks = KEYED_PARTS.flatMap((part) => overlay[part]);
    const put = chunks.filter((c) => this.#sent.get(c.key) !== c.items).map((c): [string, readonly PathItem[]] => [c.key, c.items]);
    const wanted = new Set(chunks.map((c) => c.key));
    const drop = [...this.#sent.keys()].filter((key) => !wanted.has(key));
    const ops: ChunkOps = { put, drop };

    for (const part of KEYED_PARTS) {
      const order = overlay[part].map((c) => c.key);
      if (sameKeys(this.#orders[part], order)) {
        continue;
      }
      ops[part] = order;
      this.#orders[part] = order;
    }

    this.#sent = new Map(chunks.map((c) => [c.key, c.items]));
    const quiet = !put.length && !drop.length && KEYED_PARTS.every((part) => !ops[part]);
    return quiet ? null : ops;
  }
}
