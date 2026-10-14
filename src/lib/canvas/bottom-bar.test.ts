import { describe, expect, it } from 'vitest';
import { BAR_SLOTS, BarContext, BarSlot, barContextOf, barKeys, barLift, barShift } from './bottom-bar';
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

  it('centres on the stage left visible: a frame panel docked on the right moves it left by half its width', () => {
    expect(barShift(BarContext.Canvas, 400)).toBe(0);
    expect(barShift(BarContext.Frame, 400)).toBe(200);
    expect(barShift(BarContext.Frame, 0)).toBe(0);
  });

  it('a click on a frame tool keeps the keyboard with the frame', () => {
    expect(barKeys(BarContext.Canvas)).toBe(Region.Canvas);
    expect(barKeys(BarContext.Frame)).toBe(Region.Editor);
  });
});
