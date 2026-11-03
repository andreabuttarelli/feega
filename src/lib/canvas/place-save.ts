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
  let clock = 0;
  const placedAt = new Map<string, number>();
  const stamp = (id: string) => placedAt.set(id, ++clock);

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
      stamp(id);
      return queues[Placement.Move].schedule(id, { x, y }, SaveTiming.Now);
    },
    resize: (id: string, width: number, height: number) => {
      stamp(id);
      return queues[Placement.Resize].schedule(id, { width, height }, SaveTiming.Now);
    },
    moveGroup: (id: string, x: number, y: number) => {
      stamp(id);
      return queues[Placement.MoveGroup].schedule(id, { x, y }, SaveTiming.Now);
    },
    mark: () => clock,
    placedAfter: (id: string, mark: number) => (placedAt.get(id) ?? 0) > mark,
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

type Step = { dx: number; dy: number };
type Landing = { own: Partial<Boxed>; carry: Step };

const STILL: Step = { dx: 0, dy: 0 };

const PLACED: Record<Placement, (owner: Boxed, fields: Record<string, number>) => Landing> = {
  [Placement.Move]: (_, f) => ({ own: { x: f.x, y: f.y }, carry: STILL }),
  [Placement.Resize]: (_, f) => ({ own: { w: f.width, h: f.height }, carry: STILL }),
  [Placement.MoveGroup]: (owner, f) => ({ own: { x: f.x, y: f.y }, carry: { dx: f.x - owner.x, dy: f.y - owner.y } })
};

export function placedRows<T extends Boxed>(rows: T[], entries: readonly PlaceEntry[], membersOf: (id: string) => ReadonlySet<string>): T[] {
  return entries.reduce((current, entry) => {
    const land = PLACED[entry.action as Placement];
    const owner = current.find((row) => row.id === entry.id);
    if (!land || !owner) {
      return current;
    }

    const { own, carry } = land(owner, entry.fields);
    const members = membersOf(entry.id);
    return current.map((row) => (row.id === entry.id ? { ...row, ...own } : members.has(row.id) ? { ...row, x: row.x + carry.dx, y: row.y + carry.dy } : row));
  }, rows);
}
