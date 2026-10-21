import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from './doc';
import { SaveState } from './editor-bar';
import { FrameEditSession, type SessionPort, type SendResult } from './frame-edit-session.svelte';

const base = newMotionDoc(MotionFormat.Landscape);
const longer = (frames: number): MotionDoc => ({ ...base, durationInFrames: frames });

const accepted = async (_ops: unknown, version: number): Promise<SendResult> => ({ ok: true, version: version + 1, doc: longer(60) });

function open(send: SessionPort['send'] = accepted) {
  const port: SessionPort = {
    viewPath: () => [],
    show: vi.fn(),
    recorded: vi.fn(),
    saved: vi.fn(),
    pull: vi.fn(async () => {}),
    send: vi.fn(send)
  };
  return { port, session: new FrameEditSession({ head: { version: 1, doc: base }, selection: [] }, port) };
}

function held() {
  let release: (result: SendResult) => void = () => {};
  const send = () => new Promise<SendResult>((resolve) => (release = resolve));
  return { send, release: (result: SendResult) => release(result) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('selection', () => {
  it('select replaces the selected ids', () => {
    const { session } = open();

    session.select(['a', 'b']);

    expect(session.selection).toEqual(['a', 'b']);
  });
});

describe('applying an op result', () => {
  it('a failed op leaves the doc and raises a notice', () => {
    const { session } = open();

    session.apply({ ok: false, error: 'No such clip' }, 'Moved');

    expect(session.history.present).toBe(base);
    expect(session.notice).toBe('No such clip');
  });

  it('a good op records an edit, clears the notice and tells the host', () => {
    const { session, port } = open();
    session.notice = 'old';

    session.apply({ ok: true, doc: longer(60) }, 'Longer');

    expect(session.history.present.durationInFrames).toBe(60);
    expect(session.notice).toBe('');
    expect(port.recorded).toHaveBeenCalled();
  });

  it('the same summary within the coalesce window is one undo step', () => {
    const { session } = open();

    session.apply({ ok: true, doc: longer(60) }, 'Resize');
    session.apply({ ok: true, doc: longer(90) }, 'Resize');

    expect(session.history.past).toHaveLength(1);
  });
});

describe('live gesture', () => {
  it('shows the doc while held and records one edit on release', () => {
    const { session, port } = open();

    session.live.begin();
    session.edit(longer(60), 'Drag');
    session.edit(longer(70), 'Drag');

    expect(port.show).toHaveBeenLastCalledWith(longer(70));
    expect(session.history.past).toHaveLength(0);

    session.live.release();

    expect(session.history.present.durationInFrames).toBe(70);
    expect(session.history.past).toHaveLength(1);
  });
});

describe('save queue', () => {
  it('an edit turns the state Pending, then saves after the debounce', async () => {
    const { session, port } = open();

    session.apply({ ok: true, doc: longer(60) }, 'Longer');

    expect(session.saveState).toBe(SaveState.Pending);
    await vi.advanceTimersByTimeAsync(300);

    expect(port.send).toHaveBeenCalledTimes(1);
    expect(session.saveState).toBe(SaveState.Saved);
    expect(session.version).toBe(2);
  });

  it('edits during a save are sent in one follow-up save', async () => {
    const hold = held();
    const { session, port } = open(hold.send);

    session.apply({ ok: true, doc: longer(60) }, 'A');
    await vi.advanceTimersByTimeAsync(300);
    session.apply({ ok: true, doc: longer(70) }, 'B');
    await vi.advanceTimersByTimeAsync(300);

    expect(port.send).toHaveBeenCalledTimes(1);

    hold.release({ ok: true, version: 2, doc: longer(60) });
    await vi.advanceTimersByTimeAsync(0);

    expect(port.send).toHaveBeenCalledTimes(2);
  });

  it('a refused save is Failed and carries the server error', async () => {
    const { session } = open(async () => ({ ok: false, error: 'stale' }));

    session.apply({ ok: true, doc: longer(60) }, 'Longer');
    await vi.advanceTimersByTimeAsync(300);

    expect(session.saveState).toBe(SaveState.Failed);
    expect(session.notice).toBe('stale');
  });

  it('flushPending saves now instead of waiting for the debounce', async () => {
    const { session, port } = open();

    session.apply({ ok: true, doc: longer(60) }, 'Longer');
    await session.flushPending();

    expect(port.send).toHaveBeenCalledTimes(1);
  });
});

describe('undo and redo', () => {
  it('undo goes back and schedules a save', () => {
    const { session } = open();
    session.apply({ ok: true, doc: longer(60) }, 'Longer');

    session.undo();

    expect(session.history.present).toBe(base);
    expect(session.saveState).toBe(SaveState.Pending);
  });
});

describe('remote heads', () => {
  it('a newer head is followed and drops selected clips it no longer has', () => {
    const { session, port } = open();
    session.select(['gone']);

    expect(session.takeRemote({ version: 2, doc: longer(99) })).toBe(true);

    expect(session.version).toBe(2);
    expect(session.selection).toEqual([]);
    expect(port.saved).toHaveBeenCalled();
  });

  it('a head arriving mid-save is held and pulled after the save', async () => {
    const hold = held();
    const { session, port } = open(hold.send);
    session.apply({ ok: true, doc: longer(60) }, 'A');
    await vi.advanceTimersByTimeAsync(300);

    expect(session.takeRemote({ version: 5, doc: longer(99) })).toBe(false);

    hold.release({ ok: true, version: 2, doc: longer(60) });
    await vi.advanceTimersByTimeAsync(0);

    expect(port.pull).toHaveBeenCalled();
  });
});
