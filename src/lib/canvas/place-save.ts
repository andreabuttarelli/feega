import { failureOf, keepDirty, sendResultOf, type ActionAnswer } from './node-save';
import type { PlaceEntry } from './outbox';
import { SaveStatus, SaveTiming, SendResult, createSaveScheduler } from './save-scheduler';

type Fields = Record<string, string | number>;

type PlaceOptions = {
  send: (action: string, fields: Fields) => Promise<ActionAnswer>;
  backoffMs: (failures: number) => number;
  onStatus?: (status: SaveStatus) => void;
  announce?: { intent: (row: { id: string; x: number; y: number }) => void; refused: (id: string) => void };
};

enum Placement {
  Move = 'move',
  Resize = 'resize',
  MoveGroup = 'moveGroup'
}

const FIELDS: Record<Placement, (id: string, patch: Record<string, unknown>) => Fields> = {
  [Placement.Move]: (id, p) => ({ node_id: id, x: Number(p.x), y: Number(p.y) }),
  [Placement.Resize]: (id, p) => ({ node_id: id, width: Number(p.width), height: Number(p.height) }),
  [Placement.MoveGroup]: (id, p) => ({ id, x: Number(p.x), y: Number(p.y) })
};

export function createPlaceSaves(options: PlaceOptions) {
  const statuses = new Map<Placement, SaveStatus>();

  function announce(kind: Placement, status: SaveStatus) {
    statuses.set(kind, status);
    const all = [...statuses.values()];
    const worst = all.find((s) => s === SaveStatus.Retrying) ?? all.find((s) => s === SaveStatus.Saving) ?? SaveStatus.Saved;
    options.onStatus?.(worst);
  }

  function queueFor(kind: Placement) {
    return createSaveScheduler({
      send: async (id, patch) => {
        const answer = await options.send(kind, FIELDS[kind](id, patch));
        const result = answer.type === 'success' ? SendResult.Saved : sendResultOf(failureOf(answer));
        if (result === SendResult.Dropped) {
          options.announce?.refused(id);
        }
        return result;
      },
      debounceMs: 0,
      maxWaitMs: 0,
      backoffMs: options.backoffMs,
      onStatus: (status) => announce(kind, status)
    });
  }

  const queues: Record<Placement, ReturnType<typeof createSaveScheduler>> = {
    [Placement.Move]: queueFor(Placement.Move),
    [Placement.Resize]: queueFor(Placement.Resize),
    [Placement.MoveGroup]: queueFor(Placement.MoveGroup)
  };

  const all = Object.values(queues);

  function unsentEntries(): PlaceEntry[] {
    return (Object.entries(queues) as [Placement, (typeof queues)[Placement]][]).flatMap(([action, queue]) =>
      Object.entries(queue.unsentPatches()).map(([id, fields]) => ({ action, id, fields: fields as Record<string, number> }))
    );
  }

  function restore(entries: PlaceEntry[]) {
    for (const entry of entries) {
      const queue = queues[entry.action as Placement];
      if (queue) {
        void queue.schedule(entry.id, entry.fields, SaveTiming.Now);
      }
    }
  }

  return {
    move: (id: string, x: number, y: number) => {
      options.announce?.intent({ id, x, y });
      return queues[Placement.Move].schedule(id, { x, y }, SaveTiming.Now);
    },
    resize: (id: string, width: number, height: number) => queues[Placement.Resize].schedule(id, { width, height }, SaveTiming.Now),
    moveGroup: (id: string, x: number, y: number) => queues[Placement.MoveGroup].schedule(id, { x, y }, SaveTiming.Now),
    dirty: (id: string) => all.some((queue) => queue.dirtyKeys(id).length > 0),
    unsent: () => all.some((queue) => queue.unsent()),
    unsentEntries,
    restore,
    flush: async () => { await Promise.all(all.map((queue) => queue.flush())); }
  };
}

type Boxed = { id: string; x: number; y: number; w: number; h: number; userHeight?: number | null };

export function keepPlaced<T extends Boxed>(fresh: T[], local: T[], dirty: (id: string) => boolean): T[] {
  const mine = new Map(local.map((tile) => [tile.id, tile]));

  return fresh.map((tile) => {
    const held = mine.get(tile.id);
    if (!held || !dirty(tile.id)) {
      return tile;
    }
    return { ...tile, x: held.x, y: held.y, w: held.w, h: held.h, userHeight: held.userHeight };
  });
}

type PendingTile = Boxed & { version: number; data: Record<string, unknown> };

export function keepPending<T extends PendingTile>(fresh: T[], local: T[], dirtyKeys: (id: string) => string[], placed: (id: string) => boolean): T[] {
  return keepPlaced(keepDirty(fresh, local, dirtyKeys), local, placed);
}
