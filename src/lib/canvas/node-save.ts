import { baseOf, type NodeData } from './node-patch';
import { SERVER_WRITTEN_FIELDS } from './node-data';

export enum SaveFailure {
  Conflict = 'conflict',
  Invalid = 'invalid',
  Gone = 'gone',
  Credits = 'credits',
  Auth = 'auth',
  Network = 'network',
  Server = 'server'
}

const HTTP_CONFLICT = 409;
const HTTP_NOT_FOUND = 404;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_SERVER_ERROR = 500;
const CREDITS_EXHAUSTED = 'credits_exhausted';

const SAVE_MESSAGES: Record<SaveFailure, string> = {
  [SaveFailure.Conflict]: 'Someone else changed this node at the same time. Reload to see both edits.',
  [SaveFailure.Invalid]: 'The canvas refused this change.',
  [SaveFailure.Gone]: 'This node no longer exists. Reload the canvas.',
  [SaveFailure.Credits]: 'Not enough credits.',
  [SaveFailure.Auth]: 'Your session expired. Sign in again.',
  [SaveFailure.Network]: 'No connection: the change was not sent. Try again.',
  [SaveFailure.Server]: 'The server failed to save this change. Try again.'
};

export type ActionAnswer = {
  type: string;
  status?: number;
  data?: unknown;
};

type FailureData = { error?: string; message?: string; conflict?: boolean };

function dataOf(result: ActionAnswer): FailureData {
  return (result.data ?? {}) as FailureData;
}

export function failureOf(result: ActionAnswer): SaveFailure {
  const data = dataOf(result);
  const status = result.status ?? HTTP_SERVER_ERROR;

  if (result.type === 'network') {
    return SaveFailure.Network;
  }
  if (result.type === 'redirect') {
    return SaveFailure.Auth;
  }
  if (result.type === 'error' || status >= HTTP_SERVER_ERROR) {
    return SaveFailure.Server;
  }
  if (data.error === CREDITS_EXHAUSTED) {
    return SaveFailure.Credits;
  }
  if (status === HTTP_CONFLICT || data.conflict) {
    return SaveFailure.Conflict;
  }
  if (status === HTTP_NOT_FOUND) {
    return SaveFailure.Gone;
  }
  if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN) {
    return SaveFailure.Auth;
  }
  return SaveFailure.Invalid;
}

export function saveMessage(reason: SaveFailure, data: { message?: string } = {}): string {
  if (reason === SaveFailure.Credits && data.message) {
    return data.message;
  }
  return SAVE_MESSAGES[reason];
}

type Row = { id: string; version: number; data: Record<string, unknown>; saved?: Record<string, unknown> };

const SERVER_WRITTEN = new Set(SERVER_WRITTEN_FIELDS);

export function serverWritten(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([key]) => SERVER_WRITTEN.has(key)));
}

export function keepLocal(data: Record<string, unknown>, local: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const held = keys.filter((key) => !SERVER_WRITTEN.has(key));
  if (!held.length) {
    return data;
  }
  return { ...data, ...Object.fromEntries(held.map((key) => [key, local[key]])) };
}

export function adoptIdleRows<T extends Row>(local: T[], server: Row[], dirtyKeys: (id: string) => string[]): T[] {
  const fresh = new Map(server.map((row) => [row.id, row]));

  return local.map((tile) => {
    const row = fresh.get(tile.id);
    if (!row || row.version <= tile.version) {
      return tile;
    }
    return { ...tile, version: row.version, data: keepLocal(row.data, tile.data, dirtyKeys(tile.id)), saved: row.data };
  });
}

export function keepDirty<T extends Row>(fresh: T[], local: T[], dirtyKeys: (id: string) => string[]): T[] {
  const mine = new Map(local.map((tile) => [tile.id, tile]));

  return fresh.map((tile) => {
    const held = mine.get(tile.id);
    if (held && held.version > tile.version) {
      return held;
    }
    const keys = dirtyKeys(tile.id);
    if (!held || !keys.length) {
      return tile;
    }
    return { ...tile, data: keepLocal(tile.data, held.data, keys) };
  });
}

export function orphanedEdits(local: { id: string }[], server: { id: string }[], dirtyKeys: (id: string) => string[]): string[] {
  const alive = new Set(server.map((row) => row.id));
  return local.filter((tile) => !alive.has(tile.id) && dirtyKeys(tile.id).length).map((tile) => tile.id);
}

type RealtimeChange = { table: string; eventType: string; new: unknown };

type ShownTile = { id: string; data: Record<string, unknown>; x?: number; y?: number; displayName?: string | null };

type ChangedRow = {
  id?: string;
  data?: Record<string, unknown>;
  x?: number;
  y?: number;
  display_name?: string | null;
  deleted_at?: string | null;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export function isOwnEcho(change: RealtimeChange, tiles: ShownTile[]): boolean {
  if (change.table !== 'nodes' || change.eventType !== 'UPDATE') {
    return false;
  }
  const row = (change.new ?? {}) as ChangedRow;
  const tile = tiles.find((known) => known.id === row.id);
  if (!tile || row.deleted_at) {
    return false;
  }
  return row.x === tile.x
    && row.y === tile.y
    && (row.display_name ?? null) === (tile.displayName ?? null)
    && canonical(row.data ?? {}) === canonical(tile.data);
}

type Written = { id: string; version: number; data: Record<string, unknown> };

export type WriteOutcome =
  | { ok: true; node: Written }
  | { ok: false; reason: SaveFailure; patch: NodeData; detail?: FailureData };

export type WriteAttempt = {
  send: (patch: NodeData, base: NodeData) => Promise<ActionAnswer>;
  reread: () => Promise<NodeData | null>;
  patch: NodeData;
  base: NodeData;
};

function written(result: ActionAnswer): Written | null {
  if (result.type !== 'success') {
    return null;
  }
  return ((result.data ?? {}) as { node?: Written }).node ?? null;
}

export async function writeWithRetry(attempt: WriteAttempt): Promise<WriteOutcome> {
  const first = await attempt.send(attempt.patch, attempt.base);
  const node = written(first);
  if (node) {
    return { ok: true, node };
  }

  const reason = failureOf(first);
  if (reason !== SaveFailure.Conflict) {
    return { ok: false, reason, patch: attempt.patch, detail: dataOf(first) };
  }

  const fresh = await attempt.reread();
  if (!fresh) {
    return { ok: false, reason: SaveFailure.Gone, patch: attempt.patch };
  }

  const second = await attempt.send(attempt.patch, baseOf(fresh, attempt.patch));
  const retried = written(second);
  if (retried) {
    return { ok: true, node: retried };
  }
  return { ok: false, reason: failureOf(second), patch: attempt.patch, detail: dataOf(second) };
}
