import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HEARTBEAT_MS, TICK_MS, canvasHub, canvasPeersOf, keepCanvasMark, toCanvasMark, type CanvasMark } from './canvas-presence';
import { MARK_STALE_MS } from './frame-presence';

const self = { sessionId: 's-me', userId: 'me', name: 'me' };

describe('canvasHub sender', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('coalesces many updates inside one tick into one message', () => {
    const { port, line } = canvasHub(self, () => Date.now());
    const sent: CanvasMark[] = [];
    line.attach((mark) => sent.push(mark));
    port.update({ cursor: { x: 1, y: 1 } });
    port.update({ cursor: { x: 2, y: 2 } });
    port.update({ selection: ['a'] });
    vi.advanceTimersByTime(TICK_MS);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ cursor: { x: 2, y: 2 }, selection: ['a'] });
    port.stop();
  });

  it('sends nothing while idle until the heartbeat', () => {
    const { port, line } = canvasHub(self, () => Date.now());
    const sent: CanvasMark[] = [];
    line.attach((mark) => sent.push(mark));
    port.update({ cursor: { x: 1, y: 1 } });
    vi.advanceTimersByTime(TICK_MS);
    vi.advanceTimersByTime(HEARTBEAT_MS - TICK_MS * 2);
    expect(sent).toHaveLength(1);
    vi.advanceTimersByTime(TICK_MS * 2);
    expect(sent).toHaveLength(2);
    port.stop();
  });

  it('never sends faster than the tick', () => {
    const { port, line } = canvasHub(self, () => Date.now());
    const sent: CanvasMark[] = [];
    line.attach((mark) => sent.push(mark));
    for (let i = 0; i < 100; i += 1) {
      port.update({ cursor: { x: i, y: i } });
      vi.advanceTimersByTime(10);
    }
    expect(sent.length).toBeLessThanOrEqual(1000 / TICK_MS);
    port.stop();
  });
});

describe('canvasHub receiver', () => {
  it('drops malformed marks and stamps arrivals with local time', () => {
    const { port, line } = canvasHub(self, () => 42);
    const got: CanvasMark[] = [];
    port.listen((mark) => got.push(mark));
    line.receive({ nope: true });
    line.receive({ sessionId: 's-u', userId: 'u', name: 'u', cursor: null, selection: [], at: 1 });
    expect(got).toEqual([{ sessionId: 's-u', userId: 'u', name: 'u', cursor: null, selection: [], at: 42 }]);
  });
});

describe('canvasPeersOf', () => {
  const mark = (userId: string, at: number, sessionId = `s-${userId}`): CanvasMark => ({ sessionId, userId, name: userId, cursor: { x: 0, y: 0 }, selection: [], at });

  it('hides self and stale peers, colours the rest', () => {
    let marks = new Map<string, CanvasMark>();
    marks = keepCanvasMark(marks, mark('me', 0));
    marks = keepCanvasMark(marks, mark('old', 0));
    marks = keepCanvasMark(marks, mark('live', MARK_STALE_MS));
    const peers = canvasPeersOf(marks, 's-me', MARK_STALE_MS + 1);
    expect(peers.map((p) => p.userId)).toEqual(['live']);
    expect(peers[0].colour).toMatch(/^#/);
  });

  it('shows my other tab, in my colour', () => {
    const marks = keepCanvasMark(keepCanvasMark(new Map(), mark('me', 0)), mark('me', 0, 's-other-tab'));
    expect(canvasPeersOf(marks, 's-me', 1).map((p) => p.sessionId)).toEqual(['s-other-tab']);
  });

  it('rejects coordinates that are not finite', () => {
    expect(toCanvasMark({ sessionId: 's', userId: 'u', name: 'u', cursor: { x: Infinity, y: 0 }, selection: [], at: 1 })).toBeNull();
  });
});
