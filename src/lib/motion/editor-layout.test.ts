import { describe, expect, it } from 'vitest';
import { DEFAULT_LAYOUT, Panel, TIMELINE_MIN_PX, flip, readLayout, timelineHeight, writeLayout } from './editor-layout';

function memory() {
  const items = new Map<string, string>();
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) };
}

const broken = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  }
};

describe('editor layout', () => {
  it('remembers closed panels and the timeline height', () => {
    const store = memory();
    const layout = { chat: Panel.Closed, inspector: Panel.Open, timelinePx: 420 };

    writeLayout(store, layout);

    expect(readLayout(store)).toEqual(layout);
  });

  it('falls back to the default when storage is empty, blocked or garbled', () => {
    const garbled = memory();
    garbled.setItem('motion-editor-layout', '{"chat":"sideways","timelinePx":"tall"}');

    expect(readLayout(memory())).toEqual(DEFAULT_LAYOUT);
    expect(readLayout(broken)).toEqual(DEFAULT_LAYOUT);
    expect(readLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(readLayout(garbled)).toEqual(DEFAULT_LAYOUT);
    expect(() => writeLayout(broken, DEFAULT_LAYOUT)).not.toThrow();
  });

  it('a toggle flips a panel', () => {
    expect(flip(Panel.Open)).toBe(Panel.Closed);
    expect(flip(Panel.Closed)).toBe(Panel.Open);
  });

  it('the timeline never shrinks below its minimum nor leaves the preview without room', () => {
    expect(timelineHeight(50, 900)).toBe(TIMELINE_MIN_PX);
    expect(timelineHeight(400, 900)).toBe(400);
    expect(timelineHeight(5000, 900)).toBeLessThan(900);
    expect(timelineHeight(5000, 200)).toBe(TIMELINE_MIN_PX);
  });
});
