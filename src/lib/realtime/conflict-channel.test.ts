import { describe, expect, it } from 'vitest';
import { refusedForUser } from './conflict-channel';

const ME = 'user-me';

describe('refusedForUser', () => {
  it('is true for an open conflict whose refused write was mine', () => {
    expect(refusedForUser({ actor_id: ME, actor_kind: 'user', resolution: null }, ME)).toBe(true);
  });

  it('is false when the refused write was someone else', () => {
    expect(refusedForUser({ actor_id: 'other', actor_kind: 'user', resolution: null }, ME)).toBe(false);
  });

  it('is false once the conflict is resolved', () => {
    expect(refusedForUser({ actor_id: ME, actor_kind: 'user', resolution: 'mine' }, ME)).toBe(false);
  });

  it('is false without a signed-in user', () => {
    expect(refusedForUser({ actor_id: null, actor_kind: 'user', resolution: null }, '')).toBe(false);
  });

  it('is false for a payload with no row', () => {
    expect(refusedForUser(undefined, ME)).toBe(false);
  });
});
