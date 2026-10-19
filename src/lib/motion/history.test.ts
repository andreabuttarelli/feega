import { describe, expect, it } from 'vitest';
import { MotionFormat, newMotionDoc } from './doc';
import { HISTORY_LIMIT, UNSAVED_VERSION, adoptHead, amend, canRedo, canUndo, followHead, previousSource, record, redo, startHistory, undo } from './history';
import { Agent } from './agent-state';
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

    expect(h.past).toHaveLength(1);
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

describe('undo while the agent works or before anything was saved', () => {
  it('undo does nothing while an agent turn is drawing its draft over the timeline', () => {
    const h = record(startHistory(base), longer);

    expect(undo(h, Agent.Working)).toBe(h);
    expect(canUndo(h, Agent.Working)).toBe(false);
    expect(canRedo(undo(h), Agent.Working)).toBe(false);
  });

  it('a head pulled into a tab opened on an unsaved node cannot be undone into the blank doc', () => {
    const h = adoptHead(startHistory(base), longer, UNSAVED_VERSION);

    expect(h.present).toBe(longer);
    expect(canUndo(h)).toBe(false);
  });

  it('a head pulled into a tab that already saved is one undo step, the whole agent turn at once', () => {
    const h = adoptHead(record(startHistory(base), longer), { ...base, durationInFrames: 90 }, 4);

    expect(undo(h).present).toBe(longer);
    expect(undo(undo(h)).present).toBe(base);
  });
});

describe('undo is mine only when others edit the same frame', () => {
  it('undo reverts my edit and keeps a remote edit that landed after it', () => {
    const mine = record(startHistory(base), longer);
    const withRemote = followHead(mine, { ...longer, background: 'transparent' as typeof base.background });

    const undone = undo(withRemote);

    expect(undone.present.durationInFrames).toBe(base.durationInFrames);
    expect(undone.present.background).toBe('transparent');
  });

  it('redo puts my edit back on top of what others did meanwhile', () => {
    const undone = undo(record(startHistory(base), longer));
    const withRemote = followHead(undone, { ...base, background: 'transparent' as typeof base.background });

    const redone = redo(withRemote);

    expect(redone.present.durationInFrames).toBe(600);
    expect(redone.present.background).toBe('transparent');
  });

  it('a remote edit is not a step of my undo', () => {
    const h = followHead(startHistory(base), longer);

    expect(canUndo(h)).toBe(false);
  });

  it('a drag that continues after a remote edit does not fold the remote edit into my step', () => {
    const dragging = record(startHistory(base), longer);
    const withRemote = followHead(dragging, { ...longer, background: 'transparent' as typeof base.background });
    const dragged = amend(withRemote, { ...withRemote.present, durationInFrames: 700 });

    const undone = undo(dragged);

    expect(undone.present.background).toBe('transparent');
    expect(undone.present.durationInFrames).toBe(600);
  });
});
