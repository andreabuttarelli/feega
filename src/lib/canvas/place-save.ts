import { failureOf, sendResultOf, type ActionAnswer } from './node-save';
import { SaveStatus, SaveTiming, SendResult, createSaveScheduler } from './save-scheduler';

type Fields = Record<string, string | number>;

type PlaceOptions = {
  send: (action: string, fields: Fields) => Promise<ActionAnswer>;
  backoffMs: (failures: number) => number;
  onStatus?: (status: SaveStatus) => void;
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
        return answer.type === 'success' ? SendResult.Saved : sendResultOf(failureOf(answer));
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

  return {
    move: (id: string, x: number, y: number) => queues[Placement.Move].schedule(id, { x, y }, SaveTiming.Now),
    resize: (id: string, width: number, height: number) => queues[Placement.Resize].schedule(id, { width, height }, SaveTiming.Now),
    moveGroup: (id: string, x: number, y: number) => queues[Placement.MoveGroup].schedule(id, { x, y }, SaveTiming.Now),
    dirty: (id: string) => all.some((queue) => queue.dirtyKeys(id).length > 0),
    unsent: () => all.some((queue) => queue.unsent()),
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
