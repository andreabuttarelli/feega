import type { Json } from '$lib/database.types';
import type { Db } from '$lib/server/db/client';
import { canvasOrgOf, writeDebugRows, type DebugRow } from './debug-log-repo';

export const BATCH_VERSION = 1;
export const MAX_LINES_PER_BATCH = 200;
export const MAX_TEXT = 1000;
export const LINES_PER_SESSION = 50_000;
export const REQUESTS_PER_USER_PER_MINUTE = 600;

const SESSION = /^[\w-]{8,64}$/;
const ID = /^[\w.-]{1,64}$/;
const KIND = /^[a-z][a-z0-9-]{0,31}$/;
const MAX_DEPTH = 3;
const MAX_KEYS = 60;
const MAX_ITEMS = 32;
const MAX_SEQ = 1e9;
const MINUTE_MS = 60_000;
const REMEMBERED_SESSIONS = 5000;

export type DebugLine = { seq: number; t: number; kind: string; props: Json };
export type DebugBatch = { session: string; canvas: string | null; lines: DebugLine[] };

export enum Verdict {
  Admit = 'admit',
  TooMany = 'too-many',
  Full = 'full'
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function clamp(value: unknown, depth: number): Json | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    return value.slice(0, MAX_TEXT);
  }
  if (typeof value === 'boolean' || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ITEMS).map((item) => clamp(item, depth + 1) ?? null);
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const kept: { [key: string]: Json } = {};
  if (depth >= MAX_DEPTH) {
    return kept;
  }
  for (const [key, field] of Object.entries(value).slice(0, MAX_KEYS)) {
    const clamped = clamp(field, depth + 1);
    if (clamped !== undefined) {
      kept[key.slice(0, MAX_TEXT)] = clamped;
    }
  }
  return kept;
}

function lineOf(raw: unknown): DebugLine | null {
  if (!isRecord(raw)) {
    return null;
  }
  const { s, t, k, p } = raw;
  if (!Number.isInteger(s) || (s as number) < 0 || (s as number) > MAX_SEQ) {
    return null;
  }
  if (typeof t !== 'number' || !Number.isFinite(t) || typeof k !== 'string' || !KIND.test(k)) {
    return null;
  }
  return { seq: s as number, t, kind: k, props: isRecord(p) ? (clamp(p, 0) ?? {}) : {} };
}

export function debugBatchOf(body: string): DebugBatch | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.v !== BATCH_VERSION || typeof parsed.session !== 'string' || !SESSION.test(parsed.session) || !Array.isArray(parsed.lines)) {
    return null;
  }

  const lines = parsed.lines.slice(0, MAX_LINES_PER_BATCH).map(lineOf).filter((l): l is DebugLine => l !== null);
  if (!lines.length) {
    return null;
  }

  const canvas = typeof parsed.canvas === 'string' && ID.test(parsed.canvas) ? parsed.canvas : null;
  return { session: parsed.session, canvas, lines };
}

export function createDebugGate(clock: () => number = Date.now) {
  let minute = -1;
  let perUser = new Map<string, number>();
  const perSession = new Map<string, number>();

  return function admit(userId: string, session: string, lines: number): Verdict {
    const now = Math.floor(clock() / MINUTE_MS);
    if (now !== minute) {
      minute = now;
      perUser = new Map();
    }

    const asked = perUser.get(userId) ?? 0;
    if (asked >= REQUESTS_PER_USER_PER_MINUTE) {
      return Verdict.TooMany;
    }
    perUser.set(userId, asked + 1);

    const sent = (perSession.get(session) ?? 0) + lines;
    if (sent > LINES_PER_SESSION) {
      return Verdict.Full;
    }
    if (perSession.size > REMEMBERED_SESSIONS) {
      perSession.clear();
    }
    perSession.set(session, sent);
    return Verdict.Admit;
  };
}

type Place = { canvasId: string | null; orgId: string | null };

const places = new Map<string, Place>();

async function placeOf(db: Db | null, userId: string, batch: DebugBatch): Promise<Place> {
  const key = `${userId}:${batch.session}:${batch.canvas}`;
  const known = places.get(key);
  if (known) {
    return known;
  }

  const orgId = db && batch.canvas ? await canvasOrgOf(db, batch.canvas) : null;
  const place = { canvasId: orgId ? batch.canvas : null, orgId };
  if (places.size > REMEMBERED_SESSIONS) {
    places.clear();
  }
  places.set(key, place);
  return place;
}

export async function recordDebugBatch(batch: DebugBatch, userId: string, db: Db | null): Promise<void> {
  const { canvasId, orgId } = await placeOf(db, userId, batch);
  const rows: DebugRow[] = batch.lines.map((l) => ({ session: batch.session, seq: l.seq, t_ms: l.t, user_id: userId, org_id: orgId, canvas_id: canvasId, kind: l.kind, props: l.props }));
  await writeDebugRows(rows);
}
