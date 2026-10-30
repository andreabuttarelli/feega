import type { HistoryGraph, HistoryRow } from './timeline';

export const LIVE_DEBOUNCE_MS = 400;
export const POLL_MS = 15_000;

export enum LiveFeed {
  Realtime = 'realtime',
  Polling = 'polling'
}

export type LiveRefresh = {
  changed: () => void;
  focused: () => void;
  feed: (feed: LiveFeed) => void;
  stop: () => void;
};

export function liveRefresh(refetch: () => void): LiveRefresh {
  let pending: ReturnType<typeof setTimeout> | null = null;
  let poll: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const changed = () => {
    if (stopped || pending) {
      return;
    }
    pending = setTimeout(() => {
      pending = null;
      refetch();
    }, LIVE_DEBOUNCE_MS);
  };

  const stopPolling = () => {
    if (poll) {
      clearInterval(poll);
    }
    poll = null;
  };

  const feed = (next: LiveFeed) => {
    stopPolling();
    if (stopped || next === LiveFeed.Realtime) {
      return;
    }
    poll = setInterval(refetch, POLL_MS);
  };

  const stop = () => {
    stopped = true;
    stopPolling();
    if (pending) {
      clearTimeout(pending);
    }
    pending = null;
  };

  feed(LiveFeed.Polling);
  return { changed, focused: changed, feed, stop };
}

const sameRow = (a: HistoryRow, b: HistoryRow) => a.lane === b.lane && JSON.stringify(a.entry) === JSON.stringify(b.entry);

export function mergeGraph(prev: HistoryGraph | null, next: HistoryGraph): HistoryGraph {
  if (!prev) {
    return next;
  }

  const kept = new Map(prev.rows.map((row) => [row.entry.id, row]));
  const rows = next.rows.map((row) => {
    const old = kept.get(row.entry.id);
    return old && sameRow(old, row) ? old : row;
  });

  const unchanged = rows.length === prev.rows.length && rows.every((row, i) => row === prev.rows[i]) && JSON.stringify(prev.lanes) === JSON.stringify(next.lanes) && JSON.stringify(prev.sessions) === JSON.stringify(next.sessions);
  if (unchanged) {
    return prev;
  }
  return { lanes: next.lanes, rows, sessions: next.sessions };
}
