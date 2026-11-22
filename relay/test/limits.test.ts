import { describe, expect, it } from 'vitest';
import { Deadline, IDLE_MS, MAX_VISITORS, deadlineOf } from '../src/limits';

const NOW = 1_000_000;
const EXP = NOW + 3 * IDLE_MS;

describe('limits', () => {
  it('allows ten visitors and a 30 minute idle window', () => {
    expect(MAX_VISITORS).toBe(10);
    expect(IDLE_MS).toBe(30 * 60 * 1000);
  });

  it('is the session expiry while someone is here', () => {
    expect(deadlineOf({ expMs: EXP, emptySince: null })).toEqual({ at: EXP, why: Deadline.Expired });
  });

  it('is the idle end when nobody has been here for a while and it comes first', () => {
    expect(deadlineOf({ expMs: EXP, emptySince: NOW })).toEqual({ at: NOW + IDLE_MS, why: Deadline.Idle });
  });

  it('is the expiry when that comes before the idle end', () => {
    expect(deadlineOf({ expMs: NOW + 1000, emptySince: NOW })).toEqual({ at: NOW + 1000, why: Deadline.Expired });
  });
});
