import { describe, expect, it } from 'vitest';
import { NO_OPEN_SESSION, readSelection, type MarkFeed } from './selection-read';

const mark = (over: Record<string, unknown>) => ({ sessionId: 's1', userId: 'me', name: 'A', cursor: null, selection: ['n1'], live: [], view: { cx: 1, cy: 2, zoom: 1 }, presenting: false, chat: null, at: 100, ...over });

function feedOf(marks: Array<[number, unknown]>): MarkFeed {
  return async (_canvasId, on) => {
    const timers = marks.map(([ms, payload]) => setTimeout(() => on(payload), ms));
    return () => timers.forEach(clearTimeout);
  };
}

describe('get_selection', () => {
  it('answers with the freshest mark of the caller, early', async () => {
    const started = Date.now();

    const out = await readSelection(feedOf([[5, mark({})]]), { canvasId: 'c', userId: 'me', waitMs: 2000 });

    expect(out).toEqual({ sessions: [{ sessionId: 's1', selection: ['n1'], view: { cx: 1, cy: 2, zoom: 1 }, at: 100 }] });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('ignores marks of other users', async () => {
    const out = await readSelection(feedOf([[5, mark({ userId: 'other' })]]), { canvasId: 'c', userId: 'me', waitMs: 60 });

    expect(out).toEqual({ sessions: [], reason: NO_OPEN_SESSION });
  });

  it('ignores malformed payloads', async () => {
    const out = await readSelection(feedOf([[5, { nope: true }]]), { canvasId: 'c', userId: 'me', waitMs: 60 });

    expect(out).toEqual({ sessions: [], reason: NO_OPEN_SESSION });
  });

  it('keeps the freshest mark per session', async () => {
    const out = await readSelection(feedOf([[5, mark({ at: 200, selection: ['n2'] })], [5, mark({ at: 100, selection: ['n1'] })]]), { canvasId: 'c', userId: 'me', waitMs: 60 });

    expect(out).toEqual({ sessions: [expect.objectContaining({ selection: ['n2'], at: 200 })] });
  });

  it('answers no_open_session when the channel cannot be joined', async () => {
    const out = await readSelection(async () => {
      throw new Error('no realtime');
    }, { canvasId: 'c', userId: 'me', waitMs: 60 });

    expect(out).toEqual({ sessions: [], reason: NO_OPEN_SESSION });
  });
});
