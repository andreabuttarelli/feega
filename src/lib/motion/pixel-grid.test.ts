import { describe, expect, it } from 'vitest';
import { GridToggle, PIXEL_GRID_ZOOM, pixelGridShown } from './pixel-grid';

describe('pixel grid', () => {
  it('shows once one frame pixel covers enough screen pixels', () => {
    expect(pixelGridShown(PIXEL_GRID_ZOOM, GridToggle.On)).toBe(true);
    expect(pixelGridShown(PIXEL_GRID_ZOOM - 0.5, GridToggle.On)).toBe(false);
  });

  it('stays hidden when turned off, at any zoom', () => {
    expect(pixelGridShown(64, GridToggle.Off)).toBe(false);
  });
});
