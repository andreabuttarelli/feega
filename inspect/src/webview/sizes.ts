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
  Iphone15 = 'iphone-15',
  Iphone15Landscape = 'iphone-15-landscape',
  IphoneSe = 'iphone-se',
  IphoneSeLandscape = 'iphone-se-landscape',
  Pixel8 = 'pixel-8',
  Pixel8Landscape = 'pixel-8-landscape',
  Ipad = 'ipad',
  IpadLandscape = 'ipad-landscape',
  Custom = 'custom'
}

export enum Notch {
  None = 'none',
  Island = 'island',
  Punch = 'punch'
}

export type Insets = { top: number; right: number; bottom: number; left: number };

export type DeviceFrame = { bezel: number; radius: number; notch: Notch; insets: Insets };

type SizeSpec = { label: string; width: number | null; height: number | null; key: string | null; frame?: DeviceFrame };

const insets = (top: number, right: number, bottom: number, left: number): Insets => ({ top, right, bottom, left });

const device = (label: string, width: number, height: number, frame: DeviceFrame): SizeSpec => ({ label, width, height, key: null, frame });

export const SIZES: Record<Size, SizeSpec> = {
  [Size.Full]: { label: 'Full', width: null, height: null, key: '1' },
  [Size.Desktop]: { label: 'Desktop', width: DEVICES[Device.Desktop].width, height: 900, key: '2' },
  [Size.Laptop]: { label: 'Laptop', width: 1280, height: 800, key: null },
  [Size.TabletLandscape]: { label: 'Tablet landscape', width: 1024, height: 768, key: null },
  [Size.Tablet]: { label: 'Tablet', width: DEVICES[Device.Tablet].width, height: 1024, key: '3' },
  [Size.PhoneLarge]: { label: 'Phone 430', width: 430, height: 932, key: null },
  [Size.Phone]: { label: 'Phone', width: DEVICES[Device.Phone].width, height: 844, key: '4' },
  [Size.PhoneSmall]: { label: 'Phone 375', width: 375, height: 812, key: null },
  [Size.Iphone15]: device('iPhone 15', 393, 852, { bezel: 12, radius: 52, notch: Notch.Island, insets: insets(59, 0, 34, 0) }),
  [Size.Iphone15Landscape]: device('iPhone 15 landscape', 852, 393, { bezel: 12, radius: 52, notch: Notch.Island, insets: insets(0, 59, 21, 59) }),
  [Size.IphoneSe]: device('iPhone SE', 375, 667, { bezel: 14, radius: 32, notch: Notch.None, insets: insets(20, 0, 0, 0) }),
  [Size.IphoneSeLandscape]: device('iPhone SE landscape', 667, 375, { bezel: 14, radius: 32, notch: Notch.None, insets: insets(0, 0, 0, 0) }),
  [Size.Pixel8]: device('Pixel 8', 412, 915, { bezel: 10, radius: 40, notch: Notch.Punch, insets: insets(32, 0, 24, 0) }),
  [Size.Pixel8Landscape]: device('Pixel 8 landscape', 915, 412, { bezel: 10, radius: 40, notch: Notch.Punch, insets: insets(0, 0, 24, 32) }),
  [Size.Ipad]: device('iPad', 820, 1180, { bezel: 18, radius: 28, notch: Notch.None, insets: insets(24, 0, 20, 0) }),
  [Size.IpadLandscape]: device('iPad landscape', 1180, 820, { bezel: 18, radius: 28, notch: Notch.None, insets: insets(24, 0, 20, 0) }),
  [Size.Custom]: { label: 'Custom', width: null, height: null, key: null }
};

export const DEVICE_MENU = [Size.Iphone15, Size.IphoneSe, Size.Pixel8, Size.Ipad];

export const DEVICE_SIZES = Object.values(Size).filter((s) => SIZES[s].frame);

export const PRESETS = Object.values(Size).filter((s) => s !== Size.Custom && !SIZES[s].frame);

export const frameOf = (size: Size): DeviceFrame | null => SIZES[size].frame ?? null;

export type PageBox = { left: number; top: number; width: number; height: number };

export function pageBoxOf(frame: DeviceFrame | null, fit: Fit): PageBox {
  const { top, right, bottom, left } = frame?.insets ?? insets(0, 0, 0, 0);
  return { left, top, width: fit.width - left - right, height: fit.height - top - bottom };
}

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

const TURNS: [Size, Size][] = [
  [Size.Tablet, Size.TabletLandscape],
  [Size.Iphone15, Size.Iphone15Landscape],
  [Size.IphoneSe, Size.IphoneSeLandscape],
  [Size.Pixel8, Size.Pixel8Landscape],
  [Size.Ipad, Size.IpadLandscape]
];

const ROTATIONS = new Map<Size, Size>(TURNS.flatMap(([a, b]) => [[a, b], [b, a]]));

export const rotated = (size: Size): Size | null => ROTATIONS.get(size) ?? null;

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
  const bezel = frameOf(size)?.bezel ?? 0;
  const room = { w: stage.w - 2 * bezel, h: stage.h - 2 * bezel };
  const { scale } = frameBox(ViewportMode.Fit, room, { w: width, h: height }, width);
  return { width, height, scale: Math.min(MAX_SCALE, scale) };
}

const RESTORABLE: Size[] = [...PRESETS, ...DEVICE_SIZES, Size.Custom];

export const savedSize = (value: unknown): Size => RESTORABLE.find((s) => s === value) ?? Size.Full;
