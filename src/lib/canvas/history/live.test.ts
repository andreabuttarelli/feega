import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { LIVE_DEBOUNCE_MS, LiveFeed, POLL_MS, liveRefresh, mergeGraph } from './live';
import type { HistoryGraph, HistoryRow } from './timeline';

const row = (id: string, lane = 0, summary: string | null = null) => ({ entry: { id, summary }, lane }) as unknown as HistoryRow;
const graph = (...rows: HistoryRow[]): HistoryGraph => ({ lanes: [], rows });

describe('liveRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('a burst of changes reads the timeline once', () => {
    const refetch = vi.fn();
    const live = liveRefresh(refetch);
    live.feed(LiveFeed.Realtime);
    for (let i = 0; i < 20; i++) {
      live.changed();
    }

    vi.advanceTimersByTime(LIVE_DEBOUNCE_MS);

    expect(refetch).toHaveBeenCalledTimes(1);
    live.stop();
  });

  it('without realtime it polls, with realtime it stops polling', () => {
    const refetch = vi.fn();
    const live = liveRefresh(refetch);

    vi.advanceTimersByTime(POLL_MS * 2);
    expect(refetch).toHaveBeenCalledTimes(2);

    live.feed(LiveFeed.Realtime);
    vi.advanceTimersByTime(POLL_MS * 2);
    expect(refetch).toHaveBeenCalledTimes(2);
    live.stop();
  });

  it('a lost channel falls back to polling', () => {
    const refetch = vi.fn();
    const live = liveRefresh(refetch);
    live.feed(LiveFeed.Realtime);
    live.feed(LiveFeed.Polling);

    vi.advanceTimersByTime(POLL_MS);

    expect(refetch).toHaveBeenCalledTimes(1);
    live.stop();
  });

  it('coming back to the tab reads the timeline', () => {
    const refetch = vi.fn();
    const live = liveRefresh(refetch);
    live.feed(LiveFeed.Realtime);
    live.focused();

    vi.advanceTimersByTime(LIVE_DEBOUNCE_MS);

    expect(refetch).toHaveBeenCalledTimes(1);
    live.stop();
  });

  it('after stop nothing reads', () => {
    const refetch = vi.fn();
    const live = liveRefresh(refetch);
    live.changed();
    live.stop();

    vi.advanceTimersByTime(POLL_MS * 3);

    expect(refetch).not.toHaveBeenCalled();
  });
});

describe('mergeGraph', () => {
  it('keeps unchanged rows and adds new ones', () => {
    const prev = graph(row('a'), row('b'));
    const merged = mergeGraph(prev, graph(row('c'), row('a'), row('b')));

    expect(merged.rows.map((r) => r.entry.id)).toEqual(['c', 'a', 'b']);
    expect(merged.rows[1]).toBe(prev.rows[0]);
  });

  it('replaces a changed row', () => {
    const next = graph(row('a', 0, 'new'));

    expect(mergeGraph(graph(row('a', 0, 'old')), next).rows[0]).toBe(next.rows[0]);
  });

  it('an identical read keeps the previous graph', () => {
    const prev = graph(row('a'));

    expect(mergeGraph(prev, graph(row('a')))).toBe(prev);
  });

  it('a first read is taken as is', () => {
    const next = graph(row('a'));

    expect(mergeGraph(null, next)).toBe(next);
  });
});
