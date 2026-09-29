import { baseOf, type NodeData } from './node-patch';

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

export function adoptIdleRows<T extends Row>(local: T[], server: Row[], busy: (id: string) => boolean): T[] {
  const fresh = new Map(server.map((row) => [row.id, row]));

  return local.map((tile) => {
    const row = fresh.get(tile.id);
    if (!row || busy(tile.id) || row.version <= tile.version) {
      return tile;
    }
    return { ...tile, version: row.version, data: row.data, saved: row.data };
  });
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
