import { describe, expect, it } from 'vitest';
import { BarContext, BarMode, BarSlot, barContextFor, barSlots, readBarMode } from './bottom-bar';

describe('one bottom bar, its tools by selection', () => {
  it('a selected frame is the only selection that changes the bar', () => {
    expect(barContextFor(null)).toBe(BarContext.Canvas);
    expect(barContextFor('frame-1')).toBe(BarContext.Frame);
  });

  it('on the canvas a switch picks one short set: Design draws, Generate adds generation nodes', () => {
    expect(barSlots(BarContext.Canvas, BarMode.Design)).toEqual([BarSlot.Mode, BarSlot.Draw, BarSlot.Upload, BarSlot.FrameTemplates]);
    expect(barSlots(BarContext.Canvas, BarMode.Generate)).toEqual([BarSlot.Mode, BarSlot.Select, BarSlot.Generate, BarSlot.More, BarSlot.Templates, BarSlot.FrameTemplates]);
  });

  it('a selected frame adds Insert image and Templates for this frame and keeps every Generate tool', () => {
    for (const mode of Object.values(BarMode)) {
      const base = barSlots(BarContext.Canvas, mode);
      expect(barSlots(BarContext.Frame, mode)).toEqual([...base, BarSlot.Image, BarSlot.FrameLibrary]);
    }
    expect(barSlots(BarContext.Frame, BarMode.Generate)).toContain(BarSlot.Generate);
  });

  it('reads a remembered mode, and opens on Generate for anything else', () => {
    expect(readBarMode('generate')).toBe(BarMode.Generate);
    expect(readBarMode(null)).toBe(BarMode.Generate);
    expect(readBarMode('nope')).toBe(BarMode.Generate);
  });
});
