export const MAX_VISITORS = 10;
export const IDLE_MS = 30 * 60 * 1000;

export enum Deadline {
  Expired = 'expired',
  Idle = 'idle'
}

type Timeline = { expMs: number; emptySince: number | null };

export function deadlineOf({ expMs, emptySince }: Timeline): { at: number; why: Deadline } {
  const idleAt = emptySince === null ? Infinity : emptySince + IDLE_MS;
  return idleAt < expMs ? { at: idleAt, why: Deadline.Idle } : { at: expMs, why: Deadline.Expired };
}
