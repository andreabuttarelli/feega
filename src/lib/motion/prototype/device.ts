import { WidthSource, type Viewport } from './viewport';

export enum Device {
  Desktop = 'desktop',
  Tablet = 'tablet',
  Phone = 'phone'
}

type DeviceSpec = { label: string; width: number; key: string };

export const DEVICES: Record<Device, DeviceSpec> = {
  [Device.Desktop]: { label: 'Desktop', width: 1440, key: '1' },
  [Device.Tablet]: { label: 'Tablet', width: 768, key: '2' },
  [Device.Phone]: { label: 'Phone', width: 390, key: '3' }
};

export const DEVICE_ORDER = [Device.Desktop, Device.Tablet, Device.Phone];

export const deviceForKey = (key: string): Device | null => DEVICE_ORDER.find((d) => DEVICES[d].key === key) ?? null;

export function pressedDevice(view: Viewport): Device | null {
  if (view.source === WidthSource.Window) {
    return null;
  }
  return DEVICE_ORDER.find((d) => DEVICES[d].width === view.width) ?? null;
}
