import { describe, expect, it } from 'vitest';
import { BAR_SLOTS, BarContext, BarSlot, barContextOf, barHidden, barKeys, barLift } from './bottom-bar';
import { CanvasState } from './inline-motion';
import { Region } from './key-region.svelte';

describe('one bottom bar, its tools by context', () => {
  it('shows canvas tools while browsing and frame tools while a frame is open', () => {
    expect(barContextOf(CanvasState.Browsing)).toBe(BarContext.Canvas);
    expect(barContextOf(CanvasState.Editing)).toBe(BarContext.Frame);
  });

  it('canvas tools add nodes; frame tools draw inside the frame', () => {
    expect(BAR_SLOTS[BarContext.Canvas]).toEqual([BarSlot.Upload, BarSlot.Nodes, BarSlot.More, BarSlot.Templates, BarSlot.FrameTemplates]);
    expect(BAR_SLOTS[BarContext.Frame]).toEqual([BarSlot.Draw, BarSlot.Image, BarSlot.FrameLibrary]);
  });

  it('no slot belongs to both contexts', () => {
    const canvas = new Set(BAR_SLOTS[BarContext.Canvas]);
    expect(BAR_SLOTS[BarContext.Frame].filter((s) => canvas.has(s))).toEqual([]);
  });

  it('sits flush to the edge, above the timeline only while a frame shows one', () => {
    expect(barLift(BarContext.Canvas, 200)).toBe(0);
    expect(barLift(BarContext.Frame, 200)).toBe(200);
    expect(barLift(BarContext.Frame, 0)).toBe(0);
  });

  it('a click on a frame tool keeps the keyboard with the frame', () => {
    expect(barKeys(BarContext.Canvas)).toBe(Region.Canvas);
    expect(barKeys(BarContext.Frame)).toBe(Region.Editor);
  });

  it('only a frame being edited hides the bar for its dialogs; back on the canvas a dialog left open in the frame never hides it', () => {
    expect(barHidden(BarContext.Frame, true)).toBe(true);
    expect(barHidden(BarContext.Frame, false)).toBe(false);
    expect(barHidden(BarContext.Canvas, true)).toBe(false);
  });
});
