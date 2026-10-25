export const MAX_TAPS = 64;
const REACH = 3;

export type Kernel = { weights: number[]; step: number };

export function gaussianKernel(sigma: number): Kernel {
  const reach = Math.ceil(sigma * REACH);
  const step = Math.max(1, Math.ceil((reach + 1) / MAX_TAPS));
  const taps = Math.floor(reach / step) + 1;
  const raw = Array.from({ length: taps }, (_, i) => Math.exp(-((i * step) ** 2) / (2 * sigma * sigma)));
  const total = raw[0] + 2 * raw.slice(1).reduce((a, b) => a + b, 0);
  return { weights: raw.map((w) => w / total), step };
}
