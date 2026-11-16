import { describe, expect, it } from 'vitest';
import { DeviceClass, deviceClass, directOn, GestureGuard } from './direct-switch';

const DESKTOP = { coarse: false, mobile: false, cores: 10, memoryGb: 16 };
const PHONE = { coarse: true, mobile: true, cores: 8, memoryGb: 8 };
const WEAK = { coarse: false, mobile: false, cores: 2, memoryGb: 4 };

describe('deviceClass', () => {
  it('tells a desktop, a phone and a weak machine apart', () => {
    expect(deviceClass(DESKTOP)).toBe(DeviceClass.Desktop);
    expect(deviceClass(PHONE)).toBe(DeviceClass.Phone);
    expect(deviceClass({ ...DESKTOP, coarse: true })).toBe(DeviceClass.Phone);
    expect(deviceClass(WEAK)).toBe(DeviceClass.Weak);
    expect(deviceClass({ ...DESKTOP, memoryGb: 2 })).toBe(DeviceClass.Weak);
  });
});

describe('directOn', () => {
  it('draws gestures from tiles on every device unless direct is asked for', () => {
    expect(directOn('', null, DESKTOP)).toBe(false);
    expect(directOn('', null, PHONE)).toBe(false);
    expect(directOn('', null, WEAK)).toBe(false);
  });

  it('lets the url force either path, beating storage and the device', () => {
    expect(directOn('?directZoom=1', null, PHONE)).toBe(true);
    expect(directOn('?directZoom=0', '1', DESKTOP)).toBe(false);
  });

  it('follows the stored choice when the url says nothing', () => {
    expect(directOn('', '1', PHONE)).toBe(true);
    expect(directOn('', '0', DESKTOP)).toBe(false);
  });
});

describe('GestureGuard', () => {
  it('keeps direct when gesture frames fit the budget', () => {
    const guard = new GestureGuard();
    const slow = Array.from({ length: 200 }, (_, i) => guard.slow(i % 20 === 0 ? 20 : 4));

    expect(slow.some(Boolean)).toBe(false);
  });

  it('gives up on direct once too many early gesture frames miss the budget', () => {
    const guard = new GestureGuard();
    const slow = Array.from({ length: 200 }, (_, i) => guard.slow(i % 4 === 0 ? 30 : 4));

    expect(slow.indexOf(true)).toBeGreaterThan(0);
    expect(slow.at(-1)).toBe(true);
  });
});
