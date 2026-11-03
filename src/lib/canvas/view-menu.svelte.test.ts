import { describe, expect, it } from 'vitest';
import { FrameView } from './frame-view';
import { Command } from '$lib/motion/shortcuts';
import { VIEW_ITEMS, ZOOM_ITEMS, frameViews, zoomLevel, zoomPercent } from './view-menu.svelte';
import { CANVAS_COMMAND_OF, matchCanvasShortcut } from './shortcuts';
import { rulersPref } from './rulers-pref.svelte';

describe('the header View menu', () => {
  it('lists outlines, pixel grid, guides, rulers and pivot with their unchanged keys', () => {
    expect(VIEW_ITEMS.map((i) => i.view)).toEqual([FrameView.Outlines, FrameView.PixelGrid, FrameView.Guides, FrameView.Rulers, FrameView.Pivot]);
    expect(VIEW_ITEMS.find((i) => i.view === FrameView.Outlines)?.command).toBe(Command.ToggleOutlines);
    expect(VIEW_ITEMS.find((i) => i.view === FrameView.Outlines)?.keys).toBe('⌘Y');
  });

  it('flips the same state the keys flip', () => {
    const before = frameViews.isOn(FrameView.Outlines);
    frameViews.flip(FrameView.Outlines);
    expect(frameViews.isOn(FrameView.Outlines)).toBe(!before);
  });

  it('rulers stay a remembered preference', () => {
    const before = rulersPref.on;
    frameViews.flip(FrameView.Rulers);
    expect(rulersPref.on).toBe(!before);
    expect(frameViews.isOn(FrameView.Rulers)).toBe(!before);
  });
});

describe('zoom lives in the View menu', () => {
  it('offers fit, 100% and selection', () => {
    expect(ZOOM_ITEMS.map((i) => i.command)).toEqual([Command.PreviewFit, Command.PreviewActual, Command.PreviewSelection]);
  });

  it('names the keys the canvas listens to: ⇧1 fit, ⇧0 100%, ⇧2 selection', () => {
    expect(ZOOM_ITEMS.map((i) => i.keys)).toEqual(['⇧1', '⇧0', '⇧2']);
  });

  it('every key it names runs the same command on the canvas', () => {
    for (const item of ZOOM_ITEMS) {
      const digit = item.keys.slice(-1);
      const pressed = matchCanvasShortcut({ key: digit, code: `Digit${digit}`, shiftKey: true, metaKey: false, ctrlKey: false, altKey: false, target: null } as unknown as KeyboardEvent);
      expect(pressed).toEqual(CANVAS_COMMAND_OF[item.command]);
    }
  });

  it('reads the zoom as a whole percentage', () => {
    expect(zoomPercent(1)).toBe('100%');
    expect(zoomPercent(0.256)).toBe('26%');
    expect(zoomPercent(4)).toBe('400%');
  });

  it('shows the zoom the canvas reports', () => {
    zoomLevel.show(0.5);
    expect(zoomLevel.label).toBe('50%');
  });
});
