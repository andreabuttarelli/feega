import { describe, expect, it } from 'vitest';
import { DEVICE, DEVICES, DeviceKind } from './devices';

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
