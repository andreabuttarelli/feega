import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from './doc';
import { HISTORY_LIMIT, amend, canRedo, canUndo, previousSource, record, redo, startHistory, undo } from './history';
import { setCanvas } from './timeline';

const base = newMotionDoc(MotionFormat.Landscape);
const longer = { ...base, durationInFrames: 600 };

describe('undo and redo', () => {
  it('undo goes back to the doc before the edit, redo forward again', () => {
    const h = record(startHistory(base), longer);

    expect(undo(h).present).toBe(base);
    expect(redo(undo(h)).present).toBe(longer);
  });

  it('an agent edit is undone like a human one', () => {
    const agent = setCanvas(base, { format: MotionFormat.Vertical });
    const h = record(startHistory(base), agent.ok ? agent.doc : base);

    expect(undo(h).present.width).toBe(1920);
  });

  it('a new edit drops the redo branch', () => {
    const h = record(undo(record(startHistory(base), longer)), { ...base, durationInFrames: 90 });

    expect(canRedo(h)).toBe(false);
  });

  it('nothing to undo at the start', () => {
    expect(canUndo(startHistory(base))).toBe(false);
    expect(undo(startHistory(base)).present).toBe(base);
  });

  it('amend replaces the present without a new undo step, so a slider drag undoes in one go', () => {
    const h = amend(record(startHistory(base), longer), { ...base, durationInFrames: 700 });

    expect(h.past).toEqual([base]);
    expect(undo(h).present).toBe(base);
  });

  it('keeps a bounded past', () => {
    let h = startHistory(base);
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) {
      h = record(h, { ...base, durationInFrames: i + 1 });
    }

    expect(h.past.length).toBe(HISTORY_LIMIT);
  });
});

describe('the code of a component in earlier revisions', () => {
  it('is the last source that differs from the present one, for the diff view', () => {
    const at = (css: string) => ({ ...newMotionDoc(MotionFormat.Landscape), components: { Chat: { source: { html: '', css, js: '' }, propsSchema: { type: 'object' as const, properties: {} }, version: 1, check: null } } });
    let h = startHistory(at('a'));
    h = record(h, at('b'));
    h = record(h, { ...at('b'), durationInFrames: 99 });

    expect(previousSource(h, 'Chat')?.css).toBe('a');
    expect(previousSource(startHistory(at('a')), 'Chat')).toBeNull();
  });
});
