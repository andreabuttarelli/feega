import { describe, expect, it } from 'vitest';
import { ChipKind, type SelectionChip } from '$lib/chat-selection';
import { ChatSelection } from './chat-selection.svelte';

const chip = (id: string): SelectionChip => ({ id, kind: ChipKind.Node, type: 'image', name: id });

describe('the chips in the composer', () => {
  it('follow the live selection', () => {
    const sel = new ChatSelection();

    sel.publish([chip('a'), chip('b')]);
    expect(sel.chips.map((c) => c.id)).toEqual(['a', 'b']);

    sel.publish([chip('b')]);
    expect(sel.chips.map((c) => c.id)).toEqual(['b']);

    sel.publish([]);
    expect(sel.chips).toEqual([]);
  });

  it('a removed chip is not sent', () => {
    const sel = new ChatSelection();
    sel.publish([chip('a'), chip('b')]);

    sel.dismiss('a');

    expect(sel.chips.map((c) => c.id)).toEqual(['b']);
  });

  it('a removed chip comes back when it is selected again', () => {
    const sel = new ChatSelection();
    sel.publish([chip('a')]);
    sel.dismiss('a');

    sel.publish([]);
    sel.publish([chip('a')]);

    expect(sel.chips.map((c) => c.id)).toEqual(['a']);
  });

  it('a removed chip stays removed while the rest of the selection changes', () => {
    const sel = new ChatSelection();
    sel.publish([chip('a')]);
    sel.dismiss('a');

    sel.publish([chip('a'), chip('b')]);

    expect(sel.chips.map((c) => c.id)).toEqual(['b']);
  });
});
