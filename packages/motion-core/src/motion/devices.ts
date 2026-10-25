export enum Device {
  PhonePro = 'phone-pro',
  Phone = 'phone',
  Foldable = 'foldable',
  Android = 'android',
  LaptopPro = 'laptop-pro',
  LaptopAir = 'laptop-air',
  Monitor = 'monitor',
  Tablet = 'tablet',
  Browser = 'browser'
}

export const DEVICES = Object.values(Device) as [Device, ...Device[]];

export enum Finish {
  Default = 'default',
  Black = 'black',
  Silver = 'silver',
  White = 'white',
  Brand = 'brand'
}

export const FINISHES = Object.values(Finish) as [Finish, ...Finish[]];

export const FINISH_COLOR: Record<Exclude<Finish, Finish.Default | Finish.Brand>, string> = {
  [Finish.Black]: '#2a2a2c',
  [Finish.Silver]: '#d4d5d7',
  [Finish.White]: '#f2f1ee'
};

export enum DeviceKind {
  Phone = 'phone',
  Foldable = 'foldable',
  Laptop = 'laptop',
  Monitor = 'monitor',
  Tablet = 'tablet',
  Browser = 'browser'
}

export enum Cutout {
  None = 'none',
  Island = 'island',
  Punch = 'punch',
  Notch = 'notch'
}

export enum CameraLayout {
  None = 'none',
  ProPlateau = 'pro-plateau',
  DualPill = 'dual-pill',
  Visor = 'visor',
  Single = 'single'
}

export const GLASS_RIM = 0.7;
export const BEVEL = { share: 0.45, max: GLASS_RIM / 0.8 };

export const bevelOf = (depth: number) => Math.min(depth * BEVEL.share, BEVEL.max);

export type Rect = { width: number; height: number; radius: number };

export type DeviceSpec = {
  label: string;
  kind: DeviceKind;
  body: Rect & { depth: number };
  screen: Rect & { px: [number, number]; offsetY: number };
  cutout: { kind: Cutout; width: number; height: number; top: number };
  camera: CameraLayout;
  buttons: { side: 'left' | 'right'; top: number; length: number }[];
  base: { depth: number; thickness: number } | null;
  stand: { height: number; footDepth: number; footWidth: number } | null;
  finish: string;
  sources: string[];
};

const diagonal = (inches: number, px: [number, number]) => {
  const mm = inches * 25.4;
  const ratio = px[1] / px[0];
  const width = mm / Math.sqrt(1 + ratio * ratio);
  return { width, height: width * ratio };
};

const screenOf = (inches: number, px: [number, number], radius: number, offsetY = 0) => ({ ...diagonal(inches, px), px, radius, offsetY });

const APPLE_PHONE_PRO = 'https://www.apple.com/iphone-18-pro/specs/';
const APPLE_PHONE = 'https://www.apple.com/iphone-17/specs/';
const APPLE_FOLDABLE = 'https://www.apple.com/iphone-duo/specs/';
const PIXEL = 'https://store.google.com/product/pixel_11_specs';
const LAPTOP_PRO = 'https://www.apple.com/macbook-pro/specs/';
const LAPTOP_AIR = 'https://www.apple.com/macbook-air/specs/';
const MONITOR = 'https://www.apple.com/studio-display/specs/';
const TABLET = 'https://www.apple.com/ipad-air/specs/';

const NO_CUTOUT = { kind: Cutout.None, width: 0, height: 0, top: 0 };
const ISLAND = { kind: Cutout.Island, width: 21.7, height: 5.9, top: 2.0 };

export const DEVICE: Record<Device, DeviceSpec> = {
  [Device.PhonePro]: {
    label: 'Phone Pro 6.3″',
    kind: DeviceKind.Phone,
    body: { width: 71.9, height: 150.0, depth: 8.75, radius: 11.6 },
    screen: screenOf(6.3, [1206, 2622], 9.6),
    cutout: ISLAND,
    camera: CameraLayout.ProPlateau,
    buttons: [
      { side: 'left', top: 26, length: 8 },
      { side: 'left', top: 40, length: 16 },
      { side: 'left', top: 60, length: 16 },
      { side: 'right', top: 45, length: 24 },
      { side: 'right', top: 100, length: 18 }
    ],
    base: null,
    stand: null,
    finish: '#c9c7c2',
    sources: [APPLE_PHONE_PRO]
  },
  [Device.Phone]: {
    label: 'Phone 6.3″',
    kind: DeviceKind.Phone,
    body: { width: 71.5, height: 149.6, depth: 7.95, radius: 11.6 },
    screen: screenOf(6.3, [1206, 2622], 9.6),
    cutout: ISLAND,
    camera: CameraLayout.DualPill,
    buttons: [
      { side: 'left', top: 26, length: 8 },
      { side: 'left', top: 40, length: 16 },
      { side: 'left', top: 60, length: 16 },
      { side: 'right', top: 45, length: 24 },
      { side: 'right', top: 100, length: 18 }
    ],
    base: null,
    stand: null,
    finish: '#a9c3dc',
    sources: [APPLE_PHONE]
  },
  [Device.Foldable]: {
    label: 'Foldable Phone 7.6″',
    kind: DeviceKind.Foldable,
    body: { width: 164.6, height: 117.8, depth: 5.2, radius: 10 },
    screen: screenOf(7.6, [2670, 1878], 8),
    cutout: NO_CUTOUT,
    camera: CameraLayout.DualPill,
    buttons: [],
    base: null,
    stand: null,
    finish: '#d9d6d0',
    sources: [APPLE_FOLDABLE]
  },
  [Device.Android]: {
    label: 'Android Phone 6.3″',
    kind: DeviceKind.Phone,
    body: { width: 72.0, height: 152.8, depth: 8.6, radius: 13 },
    screen: screenOf(6.3, [1080, 2424], 11),
    cutout: { kind: Cutout.Punch, width: 3.6, height: 3.6, top: 4.2 },
    camera: CameraLayout.Visor,
    buttons: [
      { side: 'right', top: 38, length: 12 },
      { side: 'right', top: 56, length: 24 }
    ],
    base: null,
    stand: null,
    finish: '#e8e4dc',
    sources: [PIXEL]
  },
  [Device.LaptopPro]: {
    label: 'Laptop Pro 14″',
    kind: DeviceKind.Laptop,
    body: { width: 312.6, height: 221.2, depth: 6.0, radius: 12 },
    screen: screenOf(14.2, [3024, 1964], 10, 2.5),
    cutout: { kind: Cutout.Notch, width: 32, height: 7, top: 0 },
    camera: CameraLayout.None,
    buttons: [],
    base: { depth: 221.2, thickness: 9.5 },
    stand: null,
    finish: '#2e2f31',
    sources: [LAPTOP_PRO]
  },
  [Device.LaptopAir]: {
    label: 'Laptop Air 13″',
    kind: DeviceKind.Laptop,
    body: { width: 304.1, height: 215.0, depth: 4.6, radius: 11 },
    screen: screenOf(13.6, [2560, 1664], 9, 2.5),
    cutout: { kind: Cutout.Notch, width: 30, height: 6.5, top: 0 },
    camera: CameraLayout.None,
    buttons: [],
    base: { depth: 215.0, thickness: 6.7 },
    stand: null,
    finish: '#c4c6c8',
    sources: [LAPTOP_AIR]
  },
  [Device.Monitor]: {
    label: 'Studio Monitor 27″',
    kind: DeviceKind.Monitor,
    body: { width: 623, height: 362, depth: 31, radius: 6 },
    screen: screenOf(27, [5120, 2880], 1),
    cutout: NO_CUTOUT,
    camera: CameraLayout.None,
    buttons: [],
    base: null,
    stand: { height: 478, footDepth: 168, footWidth: 180 },
    finish: '#c4c6c8',
    sources: [MONITOR]
  },
  [Device.Tablet]: {
    label: 'Tablet 11″',
    kind: DeviceKind.Tablet,
    body: { width: 178.5, height: 247.6, depth: 6.1, radius: 18 },
    screen: screenOf(10.86, [1640, 2360], 12),
    cutout: NO_CUTOUT,
    camera: CameraLayout.Single,
    buttons: [{ side: 'right', top: 18, length: 30 }],
    base: null,
    stand: null,
    finish: '#b8b3c9',
    sources: [TABLET]
  },
  [Device.Browser]: {
    label: 'Browser window',
    kind: DeviceKind.Browser,
    body: { width: 320, height: 212, depth: 3, radius: 4 },
    screen: { width: 320, height: 200, radius: 0, px: [1280, 800], offsetY: -6 },
    cutout: NO_CUTOUT,
    camera: CameraLayout.None,
    buttons: [],
    base: null,
    stand: null,
    finish: '#f4f4f2',
    sources: []
  }
};

export type ScreenFacts = { px: [number, number]; aspect: string; safeTop: number };

const SIMPLE_RATIO = 32;
const SHORT_SIDE = 9;

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

function aspectOf([w, h]: [number, number]): string {
  const k = gcd(w, h);
  if (Math.max(w, h) / k <= SIMPLE_RATIO) {
    return `${w / k}:${h / k}`;
  }
  const long = Math.round((Math.max(w, h) / Math.min(w, h)) * SHORT_SIDE * 10) / 10;
  return w < h ? `${SHORT_SIDE}:${long}` : `${long}:${SHORT_SIDE}`;
}

const safeTopOf = (spec: DeviceSpec) => (spec.cutout.kind === Cutout.None ? 0 : (spec.cutout.top + spec.cutout.height) / spec.screen.height);

export const SCREEN: Record<Device, ScreenFacts> = Object.fromEntries(
  DEVICES.map((d) => [d, { px: DEVICE[d].screen.px, aspect: aspectOf(DEVICE[d].screen.px), safeTop: safeTopOf(DEVICE[d]) }])
) as Record<Device, ScreenFacts>;

export enum ScreenFit {
  Cover = 'cover',
  Contain = 'contain',
  Safe = 'safe'
}

export const SCREEN_FITS = Object.values(ScreenFit) as [ScreenFit, ...ScreenFit[]];

export const screenGuide = (d: Device) => `${d} ${SCREEN[d].px.join('×')} (${SCREEN[d].aspect})`;
