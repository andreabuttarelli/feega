import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { HISTORY_TABLES, watchHistory } from './history-channel';
import { LiveFeed } from '$lib/canvas/history/live';

function fakeClient() {
  const listeners: { filter: { table: string; filter: string }; run: () => void }[] = [];
  let status: (s: string) => void = () => {};
  const channel = {
    on: (_kind: string, filter: { table: string; filter: string }, run: () => void) => {
      listeners.push({ filter, run });
      return channel;
    },
    subscribe: (on: (s: string) => void) => {
      status = on;
      return channel;
    }
  };
  const removeChannel = vi.fn();
  const client = {
    auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) },
    realtime: { setAuth: async () => {} },
    channel: () => channel,
    removeChannel
  } as unknown as SupabaseClient;
  return { client, listeners, status: (s: string) => status(s), removeChannel };
}

describe('watchHistory', () => {
  it('listens to every history table of the canvas and reports the feed', async () => {
    const fake = fakeClient();
    const onChange = vi.fn();
    const onFeed = vi.fn();

    const stop = watchHistory(fake.client, 'c1', onChange, onFeed);
    await vi.waitFor(() => expect(fake.listeners.length).toBe(HISTORY_TABLES.length));

    fake.listeners.forEach((l) => l.run());
    fake.status('SUBSCRIBED');
    fake.status('CHANNEL_ERROR');

    expect(fake.listeners.map((l) => l.filter.table)).toEqual([...HISTORY_TABLES]);
    expect(fake.listeners.every((l) => l.filter.filter === 'canvas_id=eq.c1')).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(HISTORY_TABLES.length);
    expect(onFeed.mock.calls.map((c) => c[0])).toEqual([LiveFeed.Realtime, LiveFeed.Polling]);

    stop();
    expect(fake.removeChannel).toHaveBeenCalled();
  });
});
