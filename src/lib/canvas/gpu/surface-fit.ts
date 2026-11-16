export const MAX_TARGET_SIDE = 4096;
export const OVERSCAN_MAX = 128;
const OVERSCAN_SHARE = 8;
const ROUNDING_PX = 1;

type Area = { width: number; height: number };

export function overscanOf(area: Area, resolution: number): number {
  return Math.min(Math.floor((Math.min(area.width, area.height) * resolution) / OVERSCAN_SHARE), OVERSCAN_MAX);
}

export function fitResolution(area: Area, devicePixelRatio: number, budgetResolution: number): number {
  const wanted = Math.min(devicePixelRatio, budgetResolution);
  const side = Math.max(area.width, area.height);
  if (side <= 0) {
    return wanted;
  }
  return Math.min(wanted, (MAX_TARGET_SIDE - 2 * OVERSCAN_MAX - ROUNDING_PX) / side);
}
