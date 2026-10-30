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

describe('frame steps: a saved revision reaches peers as its ops', () => {
  const ops = [{ kind: 'clip.entry', clipId: 'a', field: 'props', key: 'x', value: 0.4 }];

  it('announces the landed step and hears only well-formed steps', () => {
    const { port, heads } = frameHub({ userId: 'me', name: 'Me' });
    const sent: unknown[] = [];
    const heard: unknown[] = [];
    heads.attach((step) => sent.push(step));
    port.onHead((step) => heard.push(step));

    port.landed({ nodeId: 'n1', base: 3, version: 4, ops: ops as never });
    heads.receive({ nodeId: 'n1', base: 3, version: 'x', ops });
    heads.receive({ nodeId: 'n1', base: 4, version: 5, ops: [{ kind: 'nonsense' }] });
    heads.receive({ nodeId: 'n1', base: 4, version: 5, ops });

    expect(sent).toEqual([{ nodeId: 'n1', base: 3, version: 4, ops }]);
    expect(heard).toEqual([{ nodeId: 'n1', base: 4, version: 5, ops }]);
  });

  it('says nothing while detached', () => {
    const { port } = frameHub({ userId: 'me', name: 'Me' });
    expect(() => port.landed({ nodeId: 'n1', base: 3, version: 4, ops: ops as never })).not.toThrow();
  });
});
