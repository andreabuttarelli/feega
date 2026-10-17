import { describe, expect, it } from 'vitest';
import { reopened } from './reopen-session';

const session = { head: { version: 2, doc: 'v2' }, tokens: 't' };

describe('reopening a frame', () => {
  it('reuses the last session with the head the editor left, so opening fetches nothing', () => {
    expect(reopened(session, { version: 4, doc: 'v4' }, 4)).toEqual({ head: { version: 4, doc: 'v4' }, tokens: 't' });
  });

  it('a peer saved after the editor closed: the cached session is stale', () => {
    expect(reopened(session, { version: 4, doc: 'v4' }, 5)).toBeNull();
  });

  it('a frame never opened has nothing to reuse', () => {
    expect(reopened(null, null, 1)).toBeNull();
  });
});
