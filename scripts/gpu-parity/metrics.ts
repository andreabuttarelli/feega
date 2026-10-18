const WINDOW = 8;
const PEAK = 255;
const C1 = (0.01 * PEAK) ** 2;
const C2 = (0.03 * PEAK) ** 2;
const REC601 = [0.299, 0.587, 0.114];

export function luma(rgba: Uint8Array): Float32Array {
  const out = new Float32Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) {
    const alpha = rgba[i * 4 + 3] / PEAK;
    out[i] = alpha * (REC601[0] * rgba[i * 4] + REC601[1] * rgba[i * 4 + 1] + REC601[2] * rgba[i * 4 + 2]);
  }
  return out;
}

export function ssim(a: Float32Array, b: Float32Array, width: number, height: number): number {
  let total = 0;
  let windows = 0;
  for (let y = 0; y + WINDOW <= height; y += WINDOW) {
    for (let x = 0; x + WINDOW <= width; x += WINDOW) {
      let ma = 0;
      let mb = 0;
      for (let j = 0; j < WINDOW; j++) {
        for (let i = 0; i < WINDOW; i++) {
          ma += a[(y + j) * width + x + i];
          mb += b[(y + j) * width + x + i];
        }
      }
      const n = WINDOW * WINDOW;
      ma /= n;
      mb /= n;
      let va = 0;
      let vb = 0;
      let cov = 0;
      for (let j = 0; j < WINDOW; j++) {
        for (let i = 0; i < WINDOW; i++) {
          const da = a[(y + j) * width + x + i] - ma;
          const db = b[(y + j) * width + x + i] - mb;
          va += da * da;
          vb += db * db;
          cov += da * db;
        }
      }
      va /= n - 1;
      vb /= n - 1;
      cov /= n - 1;
      total += ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
      windows += 1;
    }
  }
  return windows ? total / windows : 1;
}

export function psnr(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - b[i]) ** 2;
  }
  const mse = sum / a.length;
  return mse === 0 ? Number.POSITIVE_INFINITY : 10 * Math.log10((PEAK * PEAK) / mse);
}
