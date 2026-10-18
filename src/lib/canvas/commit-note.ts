import { z } from 'zod';
import { keepLocal } from './node-save';

export const COMMIT_EVENT = 'committed';
const MAX_ROWS = 200;

const rowSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional()
});

const noteSchema = z.object({ sessionId: z.string().min(1), rows: z.array(rowSchema).max(MAX_ROWS) });

export type CommittedRow = z.infer<typeof rowSchema>;

export type CommitNote = z.infer<typeof noteSchema>;

type Held = { id: string; version: number; data: Record<string, unknown>; saved: Record<string, unknown>; x: number; y: number };

export function toCommitNote(raw: unknown): CommitNote | null {
  const parsed = noteSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function adoptRow<T extends Held>(tile: T, row: CommittedRow, dirtyKeys: (id: string) => string[], placed: (id: string) => boolean): T {
  let next = tile;
  if (row.data && row.version !== undefined && row.version > tile.version) {
    next = { ...next, data: keepLocal(row.data, tile.data, dirtyKeys(tile.id)), saved: row.data, version: row.version };
  }
  if (row.x !== undefined && row.y !== undefined && !placed(tile.id)) {
    next = { ...next, x: row.x, y: row.y };
  }
  return next;
}

export function adoptCommitted<T extends Held>(tiles: T[], rows: CommittedRow[], dirtyKeys: (id: string) => string[], placed: (id: string) => boolean): { tiles: T[]; refetch: boolean } {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const known = new Set(tiles.map((tile) => tile.id));
  const applicable = (row: CommittedRow) => known.has(row.id) && (row.data !== undefined || row.x !== undefined);
  const refetch = !rows.length || rows.some((row) => !applicable(row));
  const next = tiles.map((tile) => {
    const row = byId.get(tile.id);
    return row ? adoptRow(tile, row, dirtyKeys, placed) : tile;
  });
  return { tiles: next, refetch };
}

const READS = new Set(['snapshot', 'revision', 'suggestNextStep', 'share']);

type Fields = Record<string, unknown>;

const ROWS: Record<string, (fields: Fields, data: Fields) => CommittedRow[]> = {
  write: (_fields, data) => {
    const node = rowSchema.safeParse(data.node);
    return node.success ? [node.data] : [];
  },
  move: (fields) => [{ id: String(fields.node_id), x: Number(fields.x), y: Number(fields.y) }]
};

export function rowsOf(action: string, fields: Fields, data: Fields): CommittedRow[] | null {
  if (READS.has(action)) {
    return null;
  }
  return ROWS[action]?.(fields, data) ?? [];
}

export type CommitLine = { receive: (payload: unknown) => void; attach: (send: ((note: CommitNote) => void) | null) => void };

export function commitHub(sessionId: string) {
  const listeners = new Set<(note: CommitNote) => void>();
  let transmit: ((note: CommitNote) => void) | null = null;

  const line: CommitLine = {
    attach: (send) => {
      transmit = send;
    },
    receive: (raw) => {
      const note = toCommitNote(raw);
      if (note && note.sessionId !== sessionId) {
        listeners.forEach((on) => on(note));
      }
    }
  };

  return {
    line,
    publish: (rows: CommittedRow[]) => transmit?.({ sessionId, rows }),
    listen: (on: (note: CommitNote) => void) => {
      listeners.add(on);
      return () => listeners.delete(on);
    }
  };
}
