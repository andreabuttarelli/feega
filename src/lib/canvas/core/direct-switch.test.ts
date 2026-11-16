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
  it('draws gestures directly on a desktop and from tiles elsewhere', () => {
    expect(directOn('', null, DESKTOP)).toBe(true);
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
  const run = (guard: GestureGuard, intervals: number[]) => intervals.map((ms) => guard.slow(ms));
  const steady = (refresh: number, n: number) => Array.from({ length: n }, () => refresh);

  it('keeps direct at 120 Hz with rare hiccups', () => {
    const guard = new GestureGuard();
    const shown = Array.from({ length: 2000 }, (_, i) => (i % 50 === 0 ? 12 : 8.3));

    expect(run(guard, shown).some(Boolean)).toBe(false);
  });

  it('keeps direct on a steady 60 Hz screen', () => {
    expect(run(new GestureGuard(), steady(16.7, 2000)).some(Boolean)).toBe(false);
  });

  it('gives up when presented frames keep missing the refresh, late in the session too', () => {
    const guard = new GestureGuard();
    const early = run(guard, steady(8.3, 1000));
    const late = run(guard, Array.from({ length: 1000 }, (_, i) => (i % 8 === 0 ? 13 : 8.3)));

    expect(early.some(Boolean)).toBe(false);
    expect(late.at(-1)).toBe(true);
  });

  it('gives up after repeated long stalls', () => {
    const guard = new GestureGuard();
    const shown = [...steady(8.3, 500), 2700, ...steady(8.3, 500), 150, ...steady(8.3, 10)];

    expect(run(guard, shown).at(-1)).toBe(true);
  });
});
