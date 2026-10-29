import { describe, expect, it } from 'vitest';
import { FrameView } from './frame-view';
import { Command } from '$lib/motion/shortcuts';
import { VIEW_ITEMS, frameViews } from './view-menu.svelte';
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
