import { describe, expect, it } from 'vitest';
import type { UndoItem } from '$lib/canvas/undo-plan';
import { Landing, PasteState, cancelPaste, failPaste, landPaste, startPaste, undoPaste } from './paste-job';

const at = { x: 10, y: 20 };
const answer = { nodeIds: ['a', 'b'], undo: [] as UndoItem[] };

describe('paste-job', () => {
  it('shows a loading placeholder the moment the paste starts', () => {
    expect(startPaste('<b/>', at).state).toBe(PasteState.Loading);
  });

  it('undo while loading cancels, and a late answer is dropped and deleted on the server', () => {
    const cancelled = cancelPaste(startPaste('<b/>', at));
    expect(cancelled.state).toBe(PasteState.Cancelled);

    const late = landPaste(cancelled, answer);
    expect(late.landing).toBe(Landing.Discard);
    expect(late.job.nodeIds).toEqual(['a', 'b']);
  });

  it('undo after landing removes every pasted node at once', () => {
    const landed = landPaste(startPaste('<b/>', at), answer);
    expect(landed.landing).toBe(Landing.Show);

    const undone = undoPaste(landed.job);
    expect(undone.state).toBe(PasteState.Undone);
    expect(undone.nodeIds).toEqual(['a', 'b']);
  });

  it('a failed paste keeps the placeholder with an error to retry', () => {
    expect(failPaste(startPaste('<b/>', at), 'nope')).toMatchObject({ state: PasteState.Failed, error: 'nope' });
  });
});
