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

type SizeSpec = { label: string; width: number | null; height: number | null; key: string | null };

export const SIZES: Record<Size, SizeSpec> = {
  [Size.Full]: { label: 'Full', width: null, height: null, key: '1' },
  [Size.Desktop]: { label: 'Desktop', width: DEVICES[Device.Desktop].width, height: 900, key: '2' },
  [Size.Laptop]: { label: 'Laptop', width: 1280, height: 800, key: null },
  [Size.TabletLandscape]: { label: 'Tablet landscape', width: 1024, height: 768, key: null },
  [Size.Tablet]: { label: 'Tablet', width: DEVICES[Device.Tablet].width, height: 1024, key: '3' },
  [Size.PhoneLarge]: { label: 'Phone 430', width: 430, height: 932, key: null },
  [Size.Phone]: { label: 'Phone', width: DEVICES[Device.Phone].width, height: 844, key: '4' },
  [Size.PhoneSmall]: { label: 'Phone 375', width: 375, height: 812, key: null },
  [Size.Custom]: { label: 'Custom', width: null, height: null, key: null }
};

export const PRESETS = Object.values(Size).filter((s) => s !== Size.Custom);

const SNAP_PX = 8;
const MAX_SCALE = 1;

export type Stage = { w: number; h: number };

export type Fit = { width: number; height: number; scale: number };

export const sizeForKey = (key: string): Size | null => PRESETS.find((s) => SIZES[s].key === key) ?? null;

export enum Snap {
  Magnet = 'magnet',
  Coarse = 'coarse'
}

const COARSE_PX = 10;

const ROTATIONS: Partial<Record<Size, Size>> = {
  [Size.Tablet]: Size.TabletLandscape,
  [Size.TabletLandscape]: Size.Tablet
};

export const rotated = (size: Size): Size | null => ROTATIONS[size] ?? null;

export function snapped(width: number, snap = Snap.Magnet): number {
  if (snap === Snap.Coarse) {
    return clampWidth(Math.round(width / COARSE_PX) * COARSE_PX);
  }
  const near = PRESETS.map((s) => SIZES[s].width).find((w) => w !== null && Math.abs(w - width) <= SNAP_PX);
  return near ?? clampWidth(width);
}

export function fitOf(size: Size, custom: number | null, stage: Stage): Fit {
  const width = size === Size.Custom ? clampWidth(custom ?? stage.w) : (SIZES[size].width ?? stage.w);
  const height = SIZES[size].height ?? stage.h;
  const { scale } = frameBox(ViewportMode.Fit, stage, { w: width, h: height }, width);
  return { width, height, scale: Math.min(MAX_SCALE, scale) };
}
