const PARAM = 'directZoom';
const ON = '1';
const OFF = '0';

const WEAK_CORES = 4;
const WEAK_MEMORY_GB = 4;
const FRAME_BUDGET_MS = 16.7;
const SAMPLED_FRAMES = 120;
const SLOW_SHARE = 0.1;

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
  #seen = 0;
  #over = 0;
  #gaveUp = false;

  slow(frameMs: number): boolean {
    if (this.#gaveUp || this.#seen >= SAMPLED_FRAMES) {
      return this.#gaveUp;
    }
    this.#seen += 1;
    this.#over += frameMs > FRAME_BUDGET_MS ? 1 : 0;
    this.#gaveUp = this.#seen >= SAMPLED_FRAMES && this.#over / this.#seen > SLOW_SHARE;
    return this.#gaveUp;
  }
}
