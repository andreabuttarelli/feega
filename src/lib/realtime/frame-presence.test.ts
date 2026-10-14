import { describe, expect, it } from 'vitest';
import { MARK_STALE_MS, PEER_COLOURS, colourOf, frameHub, initialOf, keepMark, peersIn, toMark, type FrameMark } from './frame-presence';

const mark = (over: Partial<FrameMark> = {}): FrameMark => ({ userId: 'bo', name: 'Bo', nodeId: 'n1', cursor: { x: 0.5, y: 0.5 }, selection: [], at: 1000, ...over });

describe('who else is in this frame', () => {
  it('lists people in the same frame, never me, never another frame', () => {
    let marks = new Map<string, FrameMark>();
    marks = keepMark(marks, mark());
    marks = keepMark(marks, mark({ userId: 'me', name: 'Me' }));
    marks = keepMark(marks, mark({ userId: 'cy', name: 'Cy', nodeId: 'n2' }));

    expect(peersIn(marks, 'n1', 'me', 1000).map((p) => p.userId)).toEqual(['bo']);
  });

  it('forgets someone who stopped sending', () => {
    const marks = keepMark(new Map(), mark());

    expect(peersIn(marks, 'n1', 'me', 1000 + MARK_STALE_MS + 1)).toEqual([]);
  });

  it('keeps the newest mark when two arrive out of order', () => {
    let marks = keepMark(new Map(), mark({ at: 2000, selection: ['b'] }));
    marks = keepMark(marks, mark({ at: 1500, selection: ['a'] }));

    expect(peersIn(marks, 'n1', 'me', 2000)[0].selection).toEqual(['b']);
  });

  it('gives each person one colour, the same on every screen', () => {
    expect(colourOf('bo')).toBe(colourOf('bo'));
    expect(PEER_COLOURS).toContain(colourOf('bo'));
    expect(peersIn(keepMark(new Map(), mark()), 'n1', 'me', 1000)[0].colour).toBe(colourOf('bo'));
  });

  it('shows a name, not an email', () => {
    expect(initialOf('ana@feega.app')).toBe('A');
    expect(initialOf('')).toBe('?');
  });
});

describe('a mark off the wire', () => {
  it('is read when it has the fields a mark needs', () => {
    expect(toMark(mark())).toEqual(mark());
  });

  it('is dropped when it does not', () => {
    expect(toMark({ userId: 'bo' })).toBeNull();
    expect(toMark(null)).toBeNull();
    expect(toMark({ ...mark(), cursor: { x: 'left' } })).toBeNull();
  });
});

describe('the hub between one channel and the editors that use it', () => {
  it('stamps what I send with who I am and when, and sends only while connected', () => {
    const sent: unknown[] = [];
    const hub = frameHub({ userId: 'me', name: 'Me' }, () => 42);
    hub.port.send({ nodeId: 'n1', cursor: null, selection: ['early'] });
    hub.line.attach((m) => sent.push(m));

    hub.port.send({ nodeId: 'n1', cursor: null, selection: ['a'] });
    hub.line.attach(null);
    hub.port.send({ nodeId: 'n1', cursor: null, selection: ['late'] });

    expect(sent).toEqual([{ userId: 'me', name: 'Me', nodeId: 'n1', cursor: null, selection: ['a'], at: 42 }]);
  });

  it('hands valid marks to every listener until it leaves, stamped with my clock', () => {
    const hub = frameHub({ userId: 'me', name: 'Me' }, () => 1000);
    const heard: FrameMark[] = [];
    const stop = hub.port.listen((m) => heard.push(m));

    hub.line.receive(mark({ at: 99_999_999 }));
    hub.line.receive({ junk: true });
    stop();
    hub.line.receive(mark({ at: 2000 }));

    expect(heard).toEqual([mark()]);
  });
});
