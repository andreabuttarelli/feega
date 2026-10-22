import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { frameHub, type FrameMark, type FrameState } from '$lib/realtime/frame-presence';
import { CURSOR_SEND_MS, FramePeering, peerBoxes } from './frame-peering.svelte';

const mark = (over: Partial<FrameMark>): FrameMark => ({ userId: 'u2', name: 'ada@x.co', nodeId: 'f1', cursor: { x: 0.5, y: 0.5 }, selection: [], at: Date.now(), ...over });

function wired() {
  const hub = frameHub({ userId: 'me', name: 'me' });
  const sent: FrameState[] = [];
  hub.line.attach((m) => sent.push({ nodeId: m.nodeId, cursor: m.cursor, selection: m.selection }));
  const peering = new FramePeering(hub.port);
  return { hub, sent, peering };
}

describe('frame peering on the canvas', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the peers of a frame, never myself', () => {
    const { hub, peering } = wired();
    const stop = peering.start();

    hub.line.receive(mark({}));
    hub.line.receive(mark({ userId: 'me' }));
    hub.line.receive(mark({ userId: 'u3', nodeId: 'other' }));

    expect(peering.peersOf('f1', new Set()).map((p) => p.userId)).toEqual(['u2']);
    stop();
  });

  it('drops the frame cursor of a peer already drawn as a canvas cursor, keeping its selection', () => {
    const { hub, peering } = wired();
    const stop = peering.start();

    hub.line.receive(mark({ selection: ['t1'] }));

    expect(peering.peersOf('f1', new Set(['u2']))).toMatchObject([{ userId: 'u2', cursor: null, selection: ['t1'] }]);
    stop();
  });

  it('sends my cursor at most once per tick, and clears it when I leave', () => {
    const { sent, peering } = wired();
    const stop = peering.start();

    peering.point('f1', { x: 0.1, y: 0.2 }, ['a']);
    peering.point('f1', { x: 0.3, y: 0.4 }, ['a']);
    vi.advanceTimersByTime(CURSOR_SEND_MS);

    expect(sent).toEqual([{ nodeId: 'f1', cursor: { x: 0.3, y: 0.4 }, selection: ['a'] }]);

    stop();

    expect(sent.at(-1)).toEqual({ nodeId: null, cursor: null, selection: [] });
  });
});

describe('frame peering selection', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('a new selection is sent with the cursor I already had', () => {
    const { sent, peering } = wired();
    const stop = peering.start();

    peering.point('f1', { x: 0.1, y: 0.2 }, []);
    vi.advanceTimersByTime(CURSOR_SEND_MS);
    peering.select('f1', ['b']);
    vi.advanceTimersByTime(CURSOR_SEND_MS);

    expect(sent.at(-1)).toEqual({ nodeId: 'f1', cursor: { x: 0.1, y: 0.2 }, selection: ['b'] });
    stop();
  });
});

describe('peer boxes', () => {
  it('are clip rects as fractions of the frame', () => {
    const picker = { frameSize: () => ({ width: 200, height: 100 }), frameRect: (id: string) => (id === 'a' ? { left: 50, top: 25, width: 100, height: 50 } : null) };

    expect(peerBoxes(picker, ['a', 'gone'])).toEqual({ a: { left: 0.25, top: 0.25, width: 0.5, height: 0.5 } });
  });
});
