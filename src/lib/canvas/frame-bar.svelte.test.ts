import { describe, expect, it } from 'vitest';
import { DrawTool } from '$lib/motion/draw-tool';
import { frameBar } from './frame-bar.svelte';

describe('Esc puts the drawing tool down', () => {
  it('an armed tool goes back to Select and the key is spent', () => {
    frameBar.tool = DrawTool.Rectangle;
    expect(frameBar.disarm()).toBe(true);
    expect(frameBar.tool).toBe(DrawTool.Select);
  });

  it('with Select already in hand the key goes on to deselect', () => {
    frameBar.tool = DrawTool.Select;
    expect(frameBar.disarm()).toBe(false);
  });
});
