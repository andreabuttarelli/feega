import { describe, expect, it } from 'vitest';
import { DEVICE, DEVICES, Device, DeviceKind, GLASS_RIM, SCREEN, bevelOf } from './devices';

const TRADEMARKS = /iphone|ipad|imac|macbook|apple|pixel|google|galaxy|samsung/i;
const ASPECT_TOLERANCE = 0.005;

describe('device table', () => {
  it.each(DEVICES)('%s keeps the screen inside the body with a bezel on every side', (id) => {
    const { body, screen, kind } = DEVICE[id];
    if (kind === DeviceKind.Browser) {
      expect(screen.width).toBeLessThanOrEqual(body.width);
      return;
    }
    expect(body.width - screen.width).toBeGreaterThan(0);
    expect(body.height - screen.height).toBeGreaterThan(0);
    expect(screen.radius).toBeLessThan(body.radius + 1);
  });

  it.each(DEVICES)('%s screen has the aspect of its pixel resolution', (id) => {
    const { screen } = DEVICE[id];
    expect(Math.abs(screen.height / screen.width - screen.px[1] / screen.px[0])).toBeLessThan(ASPECT_TOLERANCE);
  });

  it.each(DEVICES.filter((id) => DEVICE[id].kind !== DeviceKind.Browser))('%s curves its edge outside the glass, so the black bezel stays flat and visible at an angle', (id) => {
    const { body, screen } = DEVICE[id];
    const curve = bevelOf(body.depth) * 0.8;

    expect(curve).toBeLessThanOrEqual(GLASS_RIM);
    expect((body.width - screen.width) / 2).toBeGreaterThan(GLASS_RIM);
  });

  it.each(DEVICES)('%s has a generic name, no trademark', (id) => {
    expect(DEVICE[id].label).not.toMatch(TRADEMARKS);
    expect(id).not.toMatch(TRADEMARKS);
  });

  it('a 6.3-inch phone has the ~2.5 mm bezel of current models', () => {
    const { body, screen } = DEVICE['phone-pro'];
    expect((body.width - screen.width) / 2).toBeGreaterThan(2);
    expect((body.width - screen.width) / 2).toBeLessThan(3);
  });

  it('the foldable opens to a landscape inner screen', () => {
    const { screen, kind } = DEVICE['foldable'];
    expect(kind).toBe(DeviceKind.Foldable);
    expect(screen.width).toBeGreaterThan(screen.height);
  });
});

describe('screen table', () => {
  it('names the real screen of every device: pixels, aspect and the band the cutout covers', () => {
    expect(SCREEN[Device.PhonePro]).toEqual({ px: [1206, 2622], aspect: '9:19.6', safeTop: expect.closeTo(0.055, 2) });
    expect(SCREEN[Device.Monitor]).toEqual({ px: [5120, 2880], aspect: '16:9', safeTop: 0 });
  });

  it.each(DEVICES)('%s keeps its safe band inside the screen', (id) => {
    expect(SCREEN[id].safeTop).toBeGreaterThanOrEqual(0);
    expect(SCREEN[id].safeTop).toBeLessThan(0.2);
  });
});
