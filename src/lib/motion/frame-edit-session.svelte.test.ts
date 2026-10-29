import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MotionFormat, newMotionDoc, type MotionDoc } from '@feega/motion-core/motion/doc';
import { EditMode } from './edit-mode';
import { SaveState } from './editor-bar';
import { DocAccess, FrameEditSession, type SessionPort, type SendResult } from './frame-edit-session.svelte';
import { outgoing } from './frame-sync';

const base = newMotionDoc(MotionFormat.Landscape);
const longer = (frames: number): MotionDoc => ({ ...base, durationInFrames: frames });

const accepted = async (_ops: unknown, version: number): Promise<SendResult> => ({ ok: true, version: version + 1, doc: longer(60) });

function open(send: SessionPort['send'] = accepted) {
  const port: SessionPort = {
    viewPath: () => [],
    show: vi.fn(),
    recorded: vi.fn(),
    stepped: vi.fn(),
    playhead: () => 12,
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

describe('the edit mode and the playhead', () => {
  it('starts in Design', () => {
    expect(open().session.mode).toBe(EditMode.Design);
  });

  it('opens in the mode the host remembered', () => {
    const { port } = open();

    expect(new FrameEditSession({ head: { version: 1, doc: base }, selection: [], mode: EditMode.Design }, port).mode).toBe(EditMode.Design);
  });

  it('reads the playhead from the host', () => {
    expect(open().session.playhead).toBe(12);
  });
});

describe('telling the host about a new undo step', () => {
  it('a new edit is one step, the same edit typed on is not another', () => {
    const { session, port } = open();

    session.apply({ ok: true, doc: longer(60) }, 'Longer');
    session.apply({ ok: true, doc: longer(70) }, 'Longer');
    session.apply({ ok: true, doc: longer(80) }, 'Other');

    expect(port.stepped).toHaveBeenCalledTimes(2);
  });

  it('a read-only session ignores edits, undo and redo', () => {
    const { session, port } = open();
    session.apply({ ok: true, doc: longer(60) }, 'Longer');
    session.access = DocAccess.Read;

    session.apply({ ok: true, doc: longer(90) }, 'Longest');
    session.undo();

    expect(session.history.present.durationInFrames).toBe(60);
    expect(port.stepped).toHaveBeenCalledTimes(1);
  });

  it('undo and redo are not new steps', () => {
    const { session, port } = open();
    session.apply({ ok: true, doc: longer(60) }, 'Longer');

    session.undo();
    session.redo();

    expect(port.stepped).toHaveBeenCalledTimes(1);
  });
});

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

  it('an edit outside a gesture is shown on the canvas before it is saved', () => {
    const { session, port } = open();

    session.apply({ ok: true, doc: longer(60) }, 'Image adjustment');

    expect(port.show).toHaveBeenLastCalledWith(session.history.present);
    expect(port.send).not.toHaveBeenCalled();
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

describe('unsaved', () => {
  it('is true from the edit until the save lands', async () => {
    const { send, release } = held();
    const { session } = open(send);
    expect(session.unsaved()).toBe(false);

    session.apply({ ok: true, doc: longer(60) }, 'Longer');
    expect(session.unsaved()).toBe(true);

    await vi.runAllTimersAsync();
    expect(session.unsaved()).toBe(true);

    release({ ok: true, version: 2, doc: longer(60) });
    await vi.runAllTimersAsync();
    expect(session.unsaved()).toBe(false);
  });
});

describe('holding the save until an upload is done', () => {
  it('sends the edit as it is when the hold ends, not as it was when it began', async () => {
    const { session, port } = open();
    let finish: () => void = () => {};
    session.holdSave(new Promise<void>((resolve) => (finish = resolve)));

    session.apply({ ok: true, doc: longer(60) }, 'Pending');
    await vi.advanceTimersByTimeAsync(1000);
    expect(port.send).not.toHaveBeenCalled();

    session.settleHeld(longer(90));
    finish();
    await vi.advanceTimersByTimeAsync(1000);

    expect(port.send).toHaveBeenCalledTimes(1);
    expect(vi.mocked(port.send).mock.calls[0][0]).toEqual(outgoing({ version: 1, doc: base }, longer(90)));
  });
});

describe('a scrub saves once', () => {
  it('a slow scrub of many ticks under a live gesture sends one save, after release', async () => {
    const { session, port } = open();
    const TICKS = 40;
    const SLOWER_THAN_THE_DEBOUNCE_MS = 400;

    session.live.begin();
    for (let i = 1; i <= TICKS; i++) {
      session.edit(longer(60 + i), 'Edited opacity');
      await vi.advanceTimersByTimeAsync(SLOWER_THAN_THE_DEBOUNCE_MS);
    }
    expect(port.send).not.toHaveBeenCalled();

    session.live.release();
    await vi.runAllTimersAsync();

    expect(port.send).toHaveBeenCalledTimes(1);
    expect(port.recorded).toHaveBeenCalledTimes(1);
  });
});
