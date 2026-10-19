export type Pixels = { data: Uint8ClampedArray; width: number; height: number };

const WINDOW = 8;
const C1 = (0.01 * 255) ** 2;
const C2 = (0.03 * 255) ** 2;
const LUMA = [0.299, 0.587, 0.114];

function luma(p: Pixels): Float64Array {
  const out = new Float64Array(p.width * p.height);
  for (let i = 0; i < out.length; i++) {
    const a = p.data[i * 4 + 3] / 255;
    const grey = LUMA[0] * p.data[i * 4] + LUMA[1] * p.data[i * 4 + 1] + LUMA[2] * p.data[i * 4 + 2];
    out[i] = grey * a + 255 * (1 - a);
  }
  return out;
}

function windowScore(a: Float64Array, b: Float64Array, width: number, x0: number, y0: number): number {
  let ma = 0;
  let mb = 0;
  const n = WINDOW * WINDOW;
  for (let y = y0; y < y0 + WINDOW; y++) {
    for (let x = x0; x < x0 + WINDOW; x++) {
      ma += a[y * width + x];
      mb += b[y * width + x];
    }
  }
  ma /= n;
  mb /= n;
  let va = 0;
  let vb = 0;
  let cov = 0;
  for (let y = y0; y < y0 + WINDOW; y++) {
    for (let x = x0; x < x0 + WINDOW; x++) {
      const da = a[y * width + x] - ma;
      const db = b[y * width + x] - mb;
      va += da * da;
      vb += db * db;
      cov += da * db;
    }
  }
  va /= n - 1;
  vb /= n - 1;
  cov /= n - 1;
  return ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2));
}

export function ssim(a: Pixels, b: Pixels): number {
  const la = luma(a);
  const lb = luma(b);
  let total = 0;
  let windows = 0;
  for (let y = 0; y + WINDOW <= a.height; y += WINDOW / 2) {
    for (let x = 0; x + WINDOW <= a.width; x += WINDOW / 2) {
      total += windowScore(la, lb, a.width, x, y);
      windows++;
    }
  }
  return windows ? total / windows : 1;
}
