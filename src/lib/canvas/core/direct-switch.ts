const PARAM = 'directZoom';
const ON = '1';
const OFF = '0';

const WEAK_CORES = 4;
const WEAK_MEMORY_GB = 4;
const WINDOW_FRAMES = 240;
const REFRESH_PERCENTILE = 0.1;
const LATE_FACTOR = 1.4;
const SLOW_SHARE = 0.05;
const STALL_MS = 100;
const STALLS_ALLOWED = 1;

export const DIRECT_STORAGE_KEY = 'feega:directZoom';

export enum DeviceClass {
  Desktop = 'desktop',
  Phone = 'phone',
  Weak = 'weak'
}

export type Device = { coarse: boolean; mobile: boolean; cores: number; memoryGb?: number };

const DIRECT_BY_DEVICE: Record<DeviceClass, boolean> = {
  [DeviceClass.Desktop]: true,
  [DeviceClass.Phone]: false,
  [DeviceClass.Weak]: false
};

export function deviceClass(device: Device): DeviceClass {
  if (device.mobile || device.coarse) {
    return DeviceClass.Phone;
  }
  if (device.cores < WEAK_CORES || (device.memoryGb !== undefined && device.memoryGb < WEAK_MEMORY_GB)) {
    return DeviceClass.Weak;
  }
  return DeviceClass.Desktop;
}

export function directOn(search: string, stored: string | null, device: Device): boolean {
  const params = new URLSearchParams(search);
  if (params.has(PARAM)) {
    return params.get(PARAM) === ON;
  }
  if (stored === ON || stored === OFF) {
    return stored === ON;
  }
  return DIRECT_BY_DEVICE[deviceClass(device)];
}

export function forcedDirect(search: string, stored: string | null): boolean {
  return new URLSearchParams(search).has(PARAM) || stored === ON || stored === OFF;
}

export function storedDirect(): string | null {
  try {
    return localStorage.getItem(DIRECT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function thisDevice(): Device {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean }; deviceMemory?: number };
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const mobile = nav.userAgentData?.mobile ?? /Mobi|Android|iPhone|iPad/i.test(nav.userAgent);
  return { coarse, mobile, cores: nav.hardwareConcurrency ?? WEAK_CORES, memoryGb: nav.deviceMemory };
}

export class GestureGuard {
  #window: number[] = [];
  #stalls = 0;
  #gaveUp = false;

  slow(presentedMs: number): boolean {
    if (this.#gaveUp) {
      return true;
    }
    this.#stalls += presentedMs >= STALL_MS ? 1 : 0;
    this.#window.push(presentedMs);
    if (this.#window.length >= WINDOW_FRAMES) {
      this.#gaveUp = lateShare(this.#window) > SLOW_SHARE;
      this.#window = [];
    }
    this.#gaveUp ||= this.#stalls > STALLS_ALLOWED;
    return this.#gaveUp;
  }
}

function lateShare(intervals: number[]): number {
  const sorted = [...intervals].sort((a, b) => a - b);
  const refresh = sorted[Math.floor(sorted.length * REFRESH_PERCENTILE)];
  return intervals.filter((ms) => ms > refresh * LATE_FACTOR).length / intervals.length;
}
