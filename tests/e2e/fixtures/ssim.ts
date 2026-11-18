import sharp from 'sharp';

const WINDOW = 8;
const C1 = (0.01 * 255) ** 2;
const C2 = (0.03 * 255) ** 2;

export type Size = { width: number; height: number };

const grey = async (png: Buffer, size: Size) => new Uint8Array(await sharp(png).resize(size.width, size.height, { fit: 'fill' }).flatten({ background: '#ffffff' }).greyscale().raw().toBuffer());

function windowSsim(a: Uint8Array, b: Uint8Array, width: number, x0: number, y0: number): number {
  let sa = 0;
  let sb = 0;
  let saa = 0;
  let sbb = 0;
  let sab = 0;
  const n = WINDOW * WINDOW;
  for (let y = y0; y < y0 + WINDOW; y++) {
    for (let x = x0; x < x0 + WINDOW; x++) {
      const p = a[y * width + x];
      const q = b[y * width + x];
      sa += p;
      sb += q;
      saa += p * p;
      sbb += q * q;
      sab += p * q;
    }
  }
  const ma = sa / n;
  const mb = sb / n;
  const cov = sab / n - ma * mb;
  return ((2 * ma * mb + C1) * (2 * cov + C2)) / ((ma * ma + mb * mb + C1) * (saa / n - ma * ma + sbb / n - mb * mb + C2));
}

export async function ssim(a: Buffer, b: Buffer, size: Size): Promise<number> {
  const [ga, gb] = await Promise.all([grey(a, size), grey(b, size)]);
  let sum = 0;
  let count = 0;
  for (let y = 0; y + WINDOW <= size.height; y += WINDOW) {
    for (let x = 0; x + WINDOW <= size.width; x += WINDOW) {
      sum += windowSsim(ga, gb, size.width, x, y);
      count++;
    }
  }
  return sum / count;
}
