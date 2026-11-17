import { describe, expect, it } from 'vitest';
import { DEVICE_ORDER, DEVICES, Device, deviceForKey, pressedDevice } from './device';
import { ViewportMode, WidthSource } from './viewport';

describe('devices', () => {
  it('maps 1, 2, 3 to desktop, tablet, phone', () => {
    expect(['1', '2', '3'].map(deviceForKey)).toEqual(DEVICE_ORDER);
    expect(deviceForKey('4')).toBeNull();
  });

  it('presses the device whose width is pinned', () => {
    const view = { mode: ViewportMode.Responsive, width: DEVICES[Device.Tablet].width, source: WidthSource.Fixed };
    expect(pressedDevice(view)).toBe(Device.Tablet);
  });

  it('presses nothing while following the window or on a custom width', () => {
    expect(pressedDevice({ mode: ViewportMode.Responsive, width: DEVICES[Device.Phone].width, source: WidthSource.Window })).toBeNull();
    expect(pressedDevice({ mode: ViewportMode.Responsive, width: 1000, source: WidthSource.Fixed })).toBeNull();
  });
});
