import { describe, expect, it } from 'vitest';
import { ChipKind, MAX_CHIPS, canvasChips, layerChips, liveChips, readChips, selectionNote, visibleChips, withoutDismissed } from './chat-selection';

const rows = [
  { id: 'n1', type: 'image', name: 'Hero shot' },
  { id: 'n2', type: 'motion', name: 'Launch video' },
  { id: 'n3', type: 'text', name: 'Text' }
];

describe('canvas selection becomes chips', () => {
  it('one node gives one chip with its name and type', () => {
    expect(canvasChips(['n1'], rows)).toEqual([{ id: 'n1', kind: ChipKind.Node, type: 'image', name: 'Hero shot' }]);
  });

  it('several nodes keep the selection order', () => {
    expect(canvasChips(['n3', 'n1'], rows).map((c) => c.id)).toEqual(['n3', 'n1']);
  });

  it('an id with no row is dropped', () => {
    expect(canvasChips(['gone', 'n2'], rows).map((c) => c.id)).toEqual(['n2']);
  });

  it('nothing selected gives no chips', () => {
    expect(canvasChips([], rows)).toEqual([]);
  });
});

describe('layers inside a frame become chips', () => {
  it('a nested layer carries the frame it lives in', () => {
    const chips = layerChips('f1', [{ id: 'l1', type: 'Text', name: 'Headline' }]);

    expect(chips).toEqual([{ id: 'l1', kind: ChipKind.Layer, type: 'Text', name: 'Headline', frameId: 'f1' }]);
  });

  it('layers win over the canvas selection while any is picked', () => {
    const layers = layerChips('f1', [{ id: 'l1', type: 'Text', name: 'Headline' }]);

    expect(liveChips(canvasChips(['f1'], [{ id: 'f1', type: 'motion', name: 'Frame' }]), layers).map((c) => c.id)).toEqual(['l1']);
  });

  it('with no layer picked the canvas selection shows', () => {
    expect(liveChips(canvasChips(['n1'], rows), []).map((c) => c.id)).toEqual(['n1']);
  });
});

describe('the chip row is capped', () => {
  const many = canvasChips(['n1', 'n2', 'n3'], rows);

  it('shows every chip up to the cap', () => {
    expect(visibleChips(many, 3)).toEqual({ shown: many, more: 0 });
  });

  it('folds the rest into a count', () => {
    const { shown, more } = visibleChips(many, 2);

    expect(shown.map((c) => c.id)).toEqual(['n1', 'n2']);
    expect(more).toBe(1);
  });
});

describe('a removed chip stays removed until its target leaves the selection', () => {
  const chips = canvasChips(['n1', 'n2'], rows);

  it('hides dismissed ids', () => {
    expect(withoutDismissed(chips, new Set(['n1'])).map((c) => c.id)).toEqual(['n2']);
  });
});

describe('the server reads chips from a request body', () => {
  it('keeps well-formed chips', () => {
    const chip = { id: 'n1', kind: 'node', type: 'image', name: 'Hero shot' };

    expect(readChips([chip])).toEqual([chip]);
  });

  it('drops malformed entries and non-arrays', () => {
    expect(readChips([{ id: 1 }, null, 'n1', { id: 'n2', kind: 'weird', type: 'x', name: 'y' }])).toEqual([]);
    expect(readChips('n1')).toEqual([]);
    expect(readChips(undefined)).toEqual([]);
  });

  it('caps the count and the name length', () => {
    const flood = Array.from({ length: MAX_CHIPS + 5 }, (_, i) => ({ id: `n${i}`, kind: 'node', type: 'text', name: 'x'.repeat(500) }));
    const read = readChips(flood);

    expect(read).toHaveLength(MAX_CHIPS);
    expect(read[0].name.length).toBeLessThan(200);
  });
});

describe('the agent is told what the chips are', () => {
  it('names nodes and layers with ids, type and frame', () => {
    const note = selectionNote([
      { id: 'n1', kind: ChipKind.Node, type: 'image', name: 'Hero shot' },
      { id: 'l1', kind: ChipKind.Layer, type: 'Text', name: 'Headline', frameId: 'f1' }
    ]);

    expect(note).toContain('node "Hero shot" (image, id n1)');
    expect(note).toContain('layer "Headline" (Text, id l1, in frame f1)');
  });

  it('is empty without chips', () => {
    expect(selectionNote([])).toBe('');
  });
});
