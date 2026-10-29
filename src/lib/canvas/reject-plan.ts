import { sameValue } from './node-patch';
import type { MoveItem } from './move-gesture';
import type { UndoItem } from './undo-plan';

export enum Keep {
  Mine = 'mine',
  Reject = 'reject'
}

export type Side = Record<string, unknown>;
export type FieldConflict = { path: string; mine: unknown; agent: unknown; original: unknown };
export type FieldMerge = { next: Side; reverted: string[]; conflicts: FieldConflict[] };

const isRecord = (value: unknown): value is Side => !!value && typeof value === 'object' && !Array.isArray(value);

function put(target: Side, key: string, value: unknown) {
  if (value === undefined) {
    delete target[key];
    return;
  }
  target[key] = value;
}

export function mergeReject(before: Side, after: Side, current: Side, choices: Record<string, Keep> = {}, prefix = ''): FieldMerge {
  const next: Side = { ...current };
  const reverted: string[] = [];
  const conflicts: FieldConflict[] = [];

  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const original = before[key];
    const agent = after[key];
    const mine = current[key];
    const path = prefix ? `${prefix}.${key}` : key;

    if (sameValue(original, agent) || sameValue(mine, original)) {
      continue;
    }

    if (isRecord(original) && isRecord(agent) && isRecord(mine)) {
      const inner = mergeReject(original, agent, mine, choices, path);
      next[key] = inner.next;
      reverted.push(...inner.reverted);
      conflicts.push(...inner.conflicts);
      continue;
    }

    const keep = sameValue(mine, agent) ? Keep.Reject : choices[path];
    if (keep === Keep.Reject) {
      put(next, key, original);
      reverted.push(path);
      continue;
    }
    if (keep !== Keep.Mine) {
      conflicts.push({ path, mine, agent, original });
    }
  }

  return { next, reverted, conflicts };
}

export enum RejectOutcome {
  Rejected = 'rejected',
  Conflict = 'conflict',
  Confirm = 'confirm',
  NotFound = 'not_found',
  Stale = 'stale'
}

export type Choice = { eventId: number; path: string; keep: Keep };
export type EventConflict = FieldConflict & { eventId: number; nodeId: string };

export type RejectResult =
  | { outcome: RejectOutcome.Rejected; undo: UndoItem[]; moves: MoveItem[]; reverted: string[] }
  | { outcome: RejectOutcome.Conflict; conflicts: EventConflict[] }
  | { outcome: RejectOutcome.Confirm; nodeId: string; touchedBy: number[] }
  | { outcome: RejectOutcome.NotFound }
  | { outcome: RejectOutcome.Stale; nodeId: string };
