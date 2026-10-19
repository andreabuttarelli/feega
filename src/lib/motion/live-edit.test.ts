import { describe, expect, it, vi } from 'vitest';
import { colourDrag, liveEdits } from './live-edit';

function port() {
  return { show: vi.fn<(doc: string | null) => void>(), record: vi.fn<(doc: string, summary: string) => void>() };
}

describe('live edits', () => {
  it('a whole colour drag shows every step and records one revision on release', () => {
    const p = port();
    const live = liveEdits(p);

    live.begin();
    for (let i = 0; i < 30; i++) {
      live.edit(`doc-${i}`, 'Edited colour');
    }
    live.release();

    expect(p.show).toHaveBeenCalledTimes(31);
    expect(p.show).toHaveBeenNthCalledWith(30, 'doc-29');
    expect(p.show).toHaveBeenLastCalledWith(null);
    expect(p.record).toHaveBeenCalledTimes(1);
    expect(p.record).toHaveBeenCalledWith('doc-29', 'Edited colour');
  });

  it('cancel puts the committed doc back and records nothing', () => {
    const p = port();
    const live = liveEdits(p);

    live.begin();
    live.edit('doc-1', 'Edited colour');
    live.cancel();
    live.release();

    expect(p.show).toHaveBeenLastCalledWith(null);
    expect(p.record).not.toHaveBeenCalled();
  });

  it('an edit outside a drag records at once', () => {
    const p = port();
    const live = liveEdits(p);

    live.edit('doc-1', 'Picked a swatch');

    expect(p.record).toHaveBeenCalledWith('doc-1', 'Picked a swatch');
    expect(p.show).not.toHaveBeenCalled();
  });

  it('a release with no step in between records nothing', () => {
    const p = port();
    const live = liveEdits(p);

    live.begin();
    live.release();

    expect(p.record).not.toHaveBeenCalled();
  });
});

describe('colour drag', () => {
  it('opens the gesture on the first step, applies every step, and releases once on drop', () => {
    const gesture = { begin: vi.fn(), release: vi.fn(), cancel: vi.fn() };
    const apply = vi.fn<(value: string) => void>();
    const drag = colourDrag(gesture, apply);

    drag.input('#111111');
    drag.input('#222222');
    drag.change('#222222');
    drag.settle();

    expect(gesture.begin).toHaveBeenCalledTimes(1);
    expect(apply.mock.calls.map(([v]) => v)).toEqual(['#111111', '#222222', '#222222']);
    expect(gesture.release).toHaveBeenCalledTimes(1);
  });

  it('cancel reverts an open drag, and without a gesture a drop still applies', () => {
    const gesture = { begin: vi.fn(), release: vi.fn(), cancel: vi.fn() };
    const drag = colourDrag(gesture, vi.fn());
    drag.input('#111111');
    drag.cancel();
    expect(gesture.cancel).toHaveBeenCalledTimes(1);
    expect(gesture.release).not.toHaveBeenCalled();

    const apply = vi.fn();
    const bare = colourDrag(null, apply);
    bare.input('#111111');
    bare.change('#222222');
    expect(apply.mock.calls).toEqual([['#222222']]);
  });
});
