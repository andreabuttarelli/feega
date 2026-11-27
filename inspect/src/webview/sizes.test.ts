import { describe, expect, it } from 'vitest';
import { Size, SIZES, Snap, fitOf, frameOf, pageBoxOf, rotated, sizeForKey, snapped } from './sizes';

describe('preview sizes', () => {
  it('full fills the panel at 100%', () => {
    expect(fitOf(Size.Full, null, { w: 900, h: 700 })).toEqual({ width: 900, height: 700, scale: 1 });
  });

  it('a preset narrower than the panel is shown at its width, unscaled', () => {
    expect(fitOf(Size.Phone, null, { w: 900, h: 900 })).toEqual({ width: 390, height: 844, scale: 1 });
  });

  it('a preset wider than the panel is scaled down to fit', () => {
    expect(fitOf(Size.Desktop, null, { w: 720, h: 700 })).toEqual({ width: 1440, height: 900, scale: 0.5 });
  });

  it('a preset taller than the panel is scaled down to fit its height', () => {
    expect(fitOf(Size.Phone, null, { w: 900, h: 422 })).toEqual({ width: 390, height: 844, scale: 0.5 });
  });

  it('a custom width wins over the preset', () => {
    expect(fitOf(Size.Custom, 500, { w: 900, h: 700 }).width).toBe(500);
  });

  it('keys 1 to 4 pick full, desktop, tablet, phone', () => {
    expect(['1', '2', '3', '4'].map(sizeForKey)).toEqual([Size.Full, Size.Desktop, Size.Tablet, Size.Phone]);
  });

  it('dragging near a preset snaps to it', () => {
    expect(snapped(763)).toBe(768);
    expect(snapped(600)).toBe(600);
  });

  it('desktop, tablet and phone are the play bar widths', () => {
    expect([SIZES[Size.Desktop].width, SIZES[Size.Tablet].width, SIZES[Size.Phone].width]).toEqual([1440, 768, 390]);
  });
});

describe('resizing by hand', () => {
  it('shift moves in 10px steps, without the preset magnet', () => {
    expect(snapped(393, Snap.Coarse)).toBe(390);
    expect(snapped(397, Snap.Coarse)).toBe(400);
  });

  it('rotate swaps tablet and tablet landscape, other sizes have no rotation', () => {
    expect(rotated(Size.Tablet)).toBe(Size.TabletLandscape);
    expect(rotated(Size.TabletLandscape)).toBe(Size.Tablet);
    expect(rotated(Size.Full)).toBe(null);
  });
});

describe('phone browser viewport', () => {
  const box = (size: Size) => pageBoxOf(frameOf(size), { width: SIZES[size].width!, height: SIZES[size].height!, scale: 1 });

  it('starts below the top safe area and ends above the bottom one', () => {
    expect(box(Size.Iphone15)).toEqual({ left: 0, top: 59, width: 393, height: 759 });
    expect(box(Size.IphoneSe)).toEqual({ left: 0, top: 20, width: 375, height: 647 });
    expect(box(Size.Ipad)).toEqual({ left: 0, top: 24, width: 820, height: 1136 });
  });

  it('keeps the side insets of a landscape notch phone', () => {
    expect(box(Size.Iphone15Landscape)).toEqual({ left: 59, top: 0, width: 734, height: 372 });
  });

  it('is the whole screen when there is no device frame', () => {
    expect(pageBoxOf(null, { width: 768, height: 1024, scale: 1 })).toEqual({ left: 0, top: 0, width: 768, height: 1024 });
  });

  it('leaves the device size alone for the size readout', () => {
    expect(fitOf(Size.Iphone15, null, { w: 1600, h: 1100 })).toMatchObject({ width: 393, height: 852 });
  });
});
