import { describe, expect, it } from 'vitest';
import { DEVICE_SIZES, Notch, Size, SIZES, fitOf, frameOf, rotated } from './sizes';

describe('device frames', () => {
  it('plain presets have no frame', () => {
    expect([Size.Full, Size.Phone, Size.Tablet, Size.Custom].map(frameOf)).toEqual([null, null, null, null]);
  });

  it('iPhone 15 is 393 x 852 with a dynamic island', () => {
    expect([SIZES[Size.Iphone15].width, SIZES[Size.Iphone15].height]).toEqual([393, 852]);
    expect(frameOf(Size.Iphone15)?.notch).toBe(Notch.Island);
  });

  it('a framed device is scaled so the bezel fits the panel too', () => {
    const bezel = frameOf(Size.Iphone15)!.bezel;
    const fit = fitOf(Size.Iphone15, null, { w: 900, h: 852 });
    expect(fit.scale).toBeCloseTo((852 - 2 * bezel) / 852);
    expect([fit.width, fit.height]).toEqual([393, 852]);
  });

  it('rotating a device swaps its width and height and back', () => {
    const turned = rotated(Size.Iphone15)!;
    expect([SIZES[turned].width, SIZES[turned].height]).toEqual([852, 393]);
    expect(rotated(turned)).toBe(Size.Iphone15);
  });

  it('every device rotates to another device', () => {
    for (const size of DEVICE_SIZES) {
      expect(frameOf(rotated(size)!)).not.toBeNull();
    }
  });

  it('the notch moves to the side in landscape', () => {
    const portrait = frameOf(Size.Iphone15)!.insets;
    const landscape = frameOf(Size.Iphone15Landscape)!.insets;
    expect(portrait.top).toBeGreaterThan(0);
    expect(landscape.top).toBe(0);
    expect(landscape.left).toBe(portrait.top);
    expect(landscape.right).toBe(portrait.top);
  });

  it('the iPhone SE has no notch and no bottom inset', () => {
    expect(frameOf(Size.IphoneSe)?.notch).toBe(Notch.None);
    expect(frameOf(Size.IphoneSe)?.insets.bottom).toBe(0);
  });

  it('devices have no shortcut key', () => {
    expect(DEVICE_SIZES.map((s) => SIZES[s].key)).toEqual(DEVICE_SIZES.map(() => null));
  });
});
