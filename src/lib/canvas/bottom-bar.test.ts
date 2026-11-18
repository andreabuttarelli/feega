import { describe, expect, it } from 'vitest';
import { BarContext, BarSlot, BarWidth, PINNED_TOOLS, barContextFor, barSlots } from './bottom-bar';
import { EditorMode } from './editor-mode.svelte';
import { DrawTool } from '$lib/motion/draw-tool';

describe('one bottom bar, everything else behind +', () => {
  it('a selected frame is the only selection that changes the insert menu', () => {
    expect(barContextFor(null)).toBe(BarContext.Canvas);
    expect(barContextFor('frame-1')).toBe(BarContext.Frame);
  });
});

describe('the pinned essentials', () => {
  it('pins rectangle, ellipse, text, pen and frame, in that order', () => {
    expect(PINNED_TOOLS).toEqual([DrawTool.Rectangle, DrawTool.Ellipse, DrawTool.Text, DrawTool.Pen, DrawTool.Frame]);
  });
});

describe('which slots the bar shows', () => {
  it('Design and Motion show everything, in bar order', () => {
    const all = [BarSlot.Select, BarSlot.Draw, BarSlot.Insert, BarSlot.Comment];
    expect(barSlots(EditorMode.Design, BarWidth.Wide)).toEqual(all);
    expect(barSlots(EditorMode.Motion, BarWidth.Wide)).toEqual(all);
  });

  it('Play and Code are read-only: no drawing tools', () => {
    const readOnly = [BarSlot.Select, BarSlot.Insert, BarSlot.Comment];
    expect(barSlots(EditorMode.Play, BarWidth.Wide)).toEqual(readOnly);
    expect(barSlots(EditorMode.Code, BarWidth.Wide)).toEqual(readOnly);
  });

  it('a narrow bar collapses both groups into +', () => {
    expect(barSlots(EditorMode.Design, BarWidth.Compact)).toEqual([BarSlot.Select, BarSlot.Insert, BarSlot.Comment]);
  });
});
