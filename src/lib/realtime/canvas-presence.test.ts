import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAT_MAX, HEARTBEAT_MS, viewportCentredOn, SETTLE_MS, TICK_MS, centreOf, followed, landedAt, presenterOf, withPeerMotion, canvasHub, canvasPeersOf, keepCanvasMark, toCanvasMark, type CanvasMark } from './canvas-presence';
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
    vi.advanceTimersByTime(TICK_MS * 3);
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

describe('adaptive rate', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a crowded canvas sends fewer ticks per second', () => {
    const { port, line } = canvasHub(self, () => Date.now());
    const sent: CanvasMark[] = [];
    line.attach((mark) => sent.push(mark));
    port.crowd(10);
    for (let i = 0; i < 100; i += 1) {
      port.update({ cursor: { x: i, y: i } });
      vi.advanceTimersByTime(10);
    }
    expect(sent.length).toBeLessThanOrEqual(6);
    port.stop();
  });
});

describe('live gesture preview', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('rides the same tick as the cursor, one message', () => {
    const { port, line } = canvasHub(self, () => Date.now());
    const sent: CanvasMark[] = [];
    line.attach((mark) => sent.push(mark));
    port.update({ cursor: { x: 1, y: 1 }, live: [{ id: 'n', x: 5, y: 6 }] });
    port.update({ live: [{ id: 'n', x: 7, y: 8, w: 100, h: 50 }] });
    vi.advanceTimersByTime(TICK_MS);
    expect(sent).toHaveLength(1);
    expect(sent[0].live).toEqual([{ id: 'n', x: 7, y: 8, w: 100, h: 50 }]);
    port.stop();
  });

  it('a mark from an older client without live reads as no gesture', () => {
    expect(toCanvasMark({ sessionId: 's', userId: 'u', name: 'u', cursor: null, selection: [], at: 1 })?.live).toEqual([]);
  });
});

describe('canvasHub receiver', () => {
  it('drops malformed marks and stamps arrivals with local time', () => {
    const { port, line } = canvasHub(self, () => 42);
    const got: CanvasMark[] = [];
    port.listen((mark) => got.push(mark));
    line.receive({ nope: true });
    line.receive({ sessionId: 's-u', userId: 'u', name: 'u', cursor: null, selection: [], live: [], at: 1 });
    expect(got).toEqual([{ sessionId: 's-u', userId: 'u', name: 'u', cursor: null, selection: [], live: [], view: null, presenting: false, chat: null, at: 42 }]);
  });
});

describe('canvasPeersOf', () => {
  const mark = (userId: string, at: number, sessionId = `s-${userId}`): CanvasMark => ({ sessionId, userId, name: userId, cursor: { x: 0, y: 0 }, selection: [], live: [], view: null, presenting: false, chat: null, at });

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

describe('a dropped ghost stays until the commit lands', () => {
  const at = (live: CanvasMark['live'], when: number): CanvasMark => ({ sessionId: 's-bo', userId: 'bo', name: 'bo', cursor: null, selection: [], live, view: null, presenting: false, chat: null, at: when });
  const box = { id: 'n', x: 300, y: 200 };

  it('keeps the last box after the drop while the node still sits at its old place', () => {
    const marks = keepCanvasMark(keepCanvasMark(new Map(), at([box], 0)), at([], 10));
    const [peer] = canvasPeersOf(marks, 's-me', 20, () => false);
    expect(peer.live).toEqual([box]);
  });

  it('lets it go once the committed position matches', () => {
    const marks = keepCanvasMark(keepCanvasMark(new Map(), at([box], 0)), at([], 10));
    const [peer] = canvasPeersOf(marks, 's-me', 20, (b) => b.id === 'n');
    expect(peer.live).toEqual([]);
  });

  it('lets it go after the settle window even if the commit never comes', () => {
    const marks = keepCanvasMark(keepCanvasMark(new Map(), at([box], 0)), at([], 10));
    const [peer] = canvasPeersOf(marks, 's-me', 10 + SETTLE_MS + 1, () => false);
    expect(peer.live).toEqual([]);
  });
});

describe('landedAt', () => {
  it('matches position, and size only when the gesture carried one', () => {
    expect(landedAt({ x: 300, y: 200, w: 10, h: 10 }, { id: 'n', x: 300.2, y: 200 })).toBe(true);
    expect(landedAt({ x: 300, y: 200, w: 10, h: 10 }, { id: 'n', x: 300, y: 200, w: 40, h: 10 })).toBe(false);
    expect(landedAt({ x: 0, y: 200, w: 10, h: 10 }, { id: 'n', x: 300, y: 200 })).toBe(false);
  });
});

describe('withPeerMotion', () => {
  const tile = { id: 'n', x: 0, y: 0, w: 10, h: 10, rotation: 0, kind: 'motion' };
  const peer = (live: CanvasMark['live']) => ({ sessionId: 's', userId: 'u', name: 'u', cursor: null, selection: [], live, view: null, presenting: false, chat: null, at: 0, colour: '#000' });

  it('moves the real tile to where the peer is dragging it', () => {
    expect(withPeerMotion([tile], [peer([{ id: 'n', x: 5, y: 6, w: 20, r: 45 }])], new Set())).toEqual([{ ...tile, x: 5, y: 6, w: 20, rotation: 45 }]);
  });

  it('leaves tiles I am moving myself alone', () => {
    expect(withPeerMotion([tile], [peer([{ id: 'n', x: 5, y: 6 }])], new Set(['n']))).toEqual([tile]);
  });

  it('returns the same array when nobody is moving anything', () => {
    const tiles = [tile];
    expect(withPeerMotion(tiles, [peer([])], new Set())).toBe(tiles);
  });
});

describe('follow and spotlight', () => {
  const peer = (userId: string, at: number, over: Partial<CanvasMark> = {}) => ({ sessionId: `s-${userId}-${at}`, userId, name: userId, cursor: null, selection: [], live: [], view: { cx: at, cy: 0, zoom: 1 }, presenting: false, chat: null, at, colour: '#000', ...over });

  it('a viewport travels as its centre in canvas units, so screen sizes do not matter', () => {
    expect(centreOf({ x: -100, y: -50, zoom: 2 }, { width: 800, height: 600 })).toEqual({ cx: 250, cy: 175, zoom: 2 });
  });

  it('following a person tracks their most recent tab', () => {
    expect(followed([peer('bo', 1), peer('bo', 5), peer('al', 9)], 'bo')).toEqual({ cx: 5, cy: 0, zoom: 1 });
    expect(followed([peer('al', 9)], 'bo')).toBeNull();
  });

  it('the presenter is whoever spotlights themselves', () => {
    expect(presenterOf([peer('al', 1), peer('bo', 2, { presenting: true })])?.userId).toBe('bo');
    expect(presenterOf([peer('al', 1)])).toBeNull();
  });

  it('marks from older clients read as not presenting, no view', () => {
    expect(toCanvasMark({ sessionId: 's', userId: 'u', name: 'u', cursor: null, selection: [], at: 1 })).toMatchObject({ view: null, presenting: false });
  });
});

describe('cursor chat', () => {
  it('a short message rides the mark, a long one is refused', () => {
    const base = { sessionId: 's', userId: 'u', name: 'u', cursor: { x: 1, y: 1 }, selection: [], at: 1 };
    expect(toCanvasMark({ ...base, chat: 'hello' })?.chat).toBe('hello');
    expect(toCanvasMark({ ...base, chat: 'x'.repeat(CHAT_MAX + 1) })).toBeNull();
    expect(toCanvasMark(base)?.chat).toBeNull();
  });
});

describe('viewportCentredOn', () => {
  it('puts a followed centre in the middle of my screen, at its zoom', () => {
    const size = { width: 800, height: 600 };
    const view = viewportCentredOn({ cx: 250, cy: 175, zoom: 2 }, size);
    expect(view).toEqual({ x: -100, y: -50, zoom: 2 });
  });
});
