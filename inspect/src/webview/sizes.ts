import { DEVICES, Device } from '@feega/properties-panel/devices';
import { ViewportMode, clampWidth, frameBox } from '@feega/properties-panel/viewport-box';

export enum Size {
  Full = 'full',
  Desktop = 'desktop',
  Laptop = 'laptop',
  TabletLandscape = 'tablet-landscape',
  Tablet = 'tablet',
  PhoneLarge = 'phone-430',
  Phone = 'phone',
  PhoneSmall = 'phone-375',
  Custom = 'custom'
}

type SizeSpec = { label: string; width: number | null; key: string | null };

export const SIZES: Record<Size, SizeSpec> = {
  [Size.Full]: { label: 'Full', width: null, key: '1' },
  [Size.Desktop]: { label: 'Desktop', width: DEVICES[Device.Desktop].width, key: '2' },
  [Size.Laptop]: { label: 'Laptop', width: 1280, key: null },
  [Size.TabletLandscape]: { label: 'Tablet landscape', width: 1024, key: null },
  [Size.Tablet]: { label: 'Tablet', width: DEVICES[Device.Tablet].width, key: '3' },
  [Size.PhoneLarge]: { label: 'Phone 430', width: 430, key: null },
  [Size.Phone]: { label: 'Phone', width: DEVICES[Device.Phone].width, key: '4' },
  [Size.PhoneSmall]: { label: 'Phone 375', width: 375, key: null },
  [Size.Custom]: { label: 'Custom', width: null, key: null }
};

export const PRESETS = Object.values(Size).filter((s) => s !== Size.Custom);

const SNAP_PX = 8;

export type Stage = { w: number; h: number };

export const sizeForKey = (key: string): Size | null => PRESETS.find((s) => SIZES[s].key === key) ?? null;

export function snapped(width: number): number {
  const near = PRESETS.map((s) => SIZES[s].width).find((w) => w !== null && Math.abs(w - width) <= SNAP_PX);
  return near ?? clampWidth(width);
}

export function fitOf(size: Size, custom: number | null, stage: Stage): { width: number; scale: number } {
  const width = size === Size.Custom ? clampWidth(custom ?? stage.w) : (SIZES[size].width ?? stage.w);
  const { scale } = frameBox(ViewportMode.Responsive, stage, { w: width, h: stage.h }, width);
  return { width, scale };
}
