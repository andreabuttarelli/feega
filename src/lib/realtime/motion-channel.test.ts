import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { headMoved, watchMotionNode } from './motion-channel';

describe('headMoved: the editor re-reads the head only when someone else moved it', () => {
  it('skips the echo of its own save and of its own poster', () => {
    expect(headMoved({ data: { docHeadRevision: 4 } }, 4)).toBe(false);
    expect(headMoved({ data: { docHeadRevision: 3 } }, 4)).toBe(false);
  });

  it('re-reads a newer head, and a row it cannot read', () => {
    expect(headMoved({ data: { docHeadRevision: 5 } }, 4)).toBe(true);
    expect(headMoved({}, 4)).toBe(true);
  });
});

describe('watchMotionNode: a dead channel comes back and re-reads the head', () => {
  it('rejoins after CLOSED and asks for a resync, and a tab wake-up asks too', async () => {
    const statuses: Array<(status: string) => void> = [];
    const channel = { on: () => channel, subscribe: (cb: (status: string) => void) => statuses.push(cb) };
    const client = {
      auth: { getSession: async () => ({ data: { session: { access_token: 'token' } } }) },
      realtime: { setAuth: async () => {} },
      channel: () => channel,
      removeChannel: async () => {}
    } as unknown as SupabaseClient;
    const retries: Array<() => void> = [];
    const onResync = vi.fn();
    let wake = () => {};

    watchMotionNode(client, 'n1', {
      onChange: () => {},
      onResync,
      environment: { online: () => true, random: () => 0, schedule: (run) => (retries.push(run), () => {}) },
      listen: (fn) => ((wake = fn), () => {})
    });
    await vi.waitFor(() => expect(statuses).toHaveLength(1));
    statuses[0]('SUBSCRIBED');
    expect(onResync).not.toHaveBeenCalled();

    statuses[0]('CLOSED');
    retries[0]();
    await vi.waitFor(() => expect(statuses).toHaveLength(2));
    statuses[1]('SUBSCRIBED');
    expect(onResync).toHaveBeenCalledTimes(1);

    wake();
    expect(onResync).toHaveBeenCalledTimes(2);
  });
});
