import { describe, expect, it } from 'vitest';
import { EditMode } from '$lib/motion/edit-mode';
import { BarContext, BarMode, barShown, BarSlot, barSlots, readBarMode, barContextOf, barHidden, barKeys, barShift } from './bottom-bar';
import { CanvasState } from './inline-motion';
import { Region } from './key-region.svelte';

describe('one bottom bar, its tools by context', () => {
  it('shows canvas tools while browsing and frame tools while a frame is open', () => {
    expect(barContextOf(CanvasState.Browsing)).toBe(BarContext.Canvas);
    expect(barContextOf(CanvasState.Editing)).toBe(BarContext.Frame);
  });

  it('on the canvas a switch picks one short set: Design draws, Generate adds generation nodes', () => {
    expect(barSlots(BarContext.Canvas, BarMode.Design)).toEqual([BarSlot.Mode, BarSlot.Draw, BarSlot.Upload, BarSlot.FrameTemplates]);
    expect(barSlots(BarContext.Canvas, BarMode.Generate)).toEqual([BarSlot.Mode, BarSlot.Select, BarSlot.Generate, BarSlot.More, BarSlot.Templates, BarSlot.FrameTemplates]);
  });

  it('the selection tool is reachable in both sets', () => {
    expect(barSlots(BarContext.Canvas, BarMode.Design)).toContain(BarSlot.Draw);
    expect(barSlots(BarContext.Canvas, BarMode.Generate)).toContain(BarSlot.Select);
  });

  it('with a frame open the bar shows frame tools and no switch, whatever mode was picked', () => {
    for (const mode of Object.values(BarMode)) {
      expect(barSlots(BarContext.Frame, mode)).toEqual([BarSlot.Draw, BarSlot.Image, BarSlot.FrameLibrary]);
    }
  });

  it('reads a remembered mode, and opens on Generate for anything else', () => {
    expect(readBarMode('generate')).toBe(BarMode.Generate);
    expect(readBarMode(null)).toBe(BarMode.Generate);
    expect(readBarMode('nope')).toBe(BarMode.Generate);
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

  it('only a frame being edited hides the bar for its dialogs; back on the canvas a dialog left open in the frame never hides it', () => {
    expect(barHidden(BarContext.Frame, true)).toBe(true);
    expect(barHidden(BarContext.Frame, false)).toBe(false);
    expect(barHidden(BarContext.Canvas, true)).toBe(false);
  });
});

describe('a frame shows one tool strip at a time', () => {
  it('Design shows the add bar; Motion hides it for the timeline; the canvas always shows it', () => {
    expect(barShown(BarContext.Frame, EditMode.Design)).toBe(true);
    expect(barShown(BarContext.Frame, EditMode.Motion)).toBe(false);
    expect(barShown(BarContext.Canvas, EditMode.Motion)).toBe(true);
    expect(barShown(BarContext.Canvas, EditMode.Design)).toBe(true);
  });
});
