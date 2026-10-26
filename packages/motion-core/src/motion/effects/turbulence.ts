export const GRAIN_SAMPLE_OFFSET = 1;

export type TurbulenceSpec = { baseFrequency: number; seed: number; octaves: number; size: number; offset: number };

export function turbulenceTile(spec: TurbulenceSpec): Uint8ClampedArray {
  const B = 0x100;
  const BM = 0xff;
  const PERLIN = 0x1000;
  const RAND_M = 2147483647;
  const RAND_A = 16807;
  const RAND_Q = 127773;
  const RAND_R = 2836;

  const random = (seed: number) => {
    const next = RAND_A * (seed % RAND_Q) - RAND_R * Math.trunc(seed / RAND_Q);
    return next <= 0 ? next + RAND_M : next;
  };

  let seed = Math.trunc(spec.seed);
  if (seed <= 0) {
    seed = -(seed % (RAND_M - 1)) + 1;
  }
  if (seed > RAND_M - 1) {
    seed = RAND_M - 1;
  }

  const lattice = new Int32Array(B + B + 2);
  const gradient = Array.from({ length: 4 }, () => new Float64Array((B + B + 2) * 2));
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < B; i++) {
      lattice[i] = i;
      for (let j = 0; j < 2; j++) {
        seed = random(seed);
        gradient[k][i * 2 + j] = ((seed % (B + B)) - B) / B;
      }
      const g0 = gradient[k][i * 2];
      const g1 = gradient[k][i * 2 + 1];
      const s = Math.sqrt(g0 * g0 + g1 * g1);
      gradient[k][i * 2] = g0 / s;
      gradient[k][i * 2 + 1] = g1 / s;
    }
  }
  for (let i = B - 1; i > 0; i--) {
    const k = lattice[i];
    seed = random(seed);
    const j = seed % B;
    lattice[i] = lattice[j];
    lattice[j] = k;
  }
  for (let i = 0; i < B + 2; i++) {
    lattice[B + i] = lattice[i];
    for (let k = 0; k < 4; k++) {
      gradient[k][(B + i) * 2] = gradient[k][i * 2];
      gradient[k][(B + i) * 2 + 1] = gradient[k][i * 2 + 1];
    }
  }

  const curve = (t: number) => t * t * (3 - 2 * t);
  const lerp = (t: number, a: number, b: number) => a + t * (b - a);

  type Stitch = { width: number; height: number; wrapX: number; wrapY: number };
  const noise2 = (channel: number, x: number, y: number, stitch: Stitch) => {
    const tx = x + PERLIN;
    let bx0 = Math.trunc(tx);
    let bx1 = bx0 + 1;
    const rx0 = tx - Math.trunc(tx);
    const rx1 = rx0 - 1;
    const ty = y + PERLIN;
    let by0 = Math.trunc(ty);
    let by1 = by0 + 1;
    const ry0 = ty - Math.trunc(ty);
    const ry1 = ry0 - 1;

    if (bx0 >= stitch.wrapX) {
      bx0 -= stitch.width;
    }
    if (bx1 >= stitch.wrapX) {
      bx1 -= stitch.width;
    }
    if (by0 >= stitch.wrapY) {
      by0 -= stitch.height;
    }
    if (by1 >= stitch.wrapY) {
      by1 -= stitch.height;
    }
    bx0 &= BM;
    bx1 &= BM;
    by0 &= BM;
    by1 &= BM;

    const i = lattice[bx0];
    const j = lattice[bx1];
    const b00 = lattice[i + by0];
    const b10 = lattice[j + by0];
    const b01 = lattice[i + by1];
    const b11 = lattice[j + by1];
    const sx = curve(rx0);
    const sy = curve(ry0);
    const g = gradient[channel];
    const a = lerp(sx, rx0 * g[b00 * 2] + ry0 * g[b00 * 2 + 1], rx1 * g[b10 * 2] + ry0 * g[b10 * 2 + 1]);
    const b = lerp(sx, rx0 * g[b01 * 2] + ry1 * g[b01 * 2 + 1], rx1 * g[b11 * 2] + ry1 * g[b11 * 2 + 1]);
    return lerp(sy, a, b);
  };

  const size = spec.size;
  const stitched = (f: number) => {
    const lo = Math.floor(size * f) / size;
    const hi = Math.ceil(size * f) / size;
    return lo && f / lo < hi / f ? lo : hi;
  };
  const freq = spec.baseFrequency ? stitched(spec.baseFrequency) : 0;
  const width = Math.trunc(size * freq + 0.5);

  const out = new Uint8ClampedArray(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      for (let channel = 0; channel < 4; channel++) {
        const stitch = { width, height: width, wrapX: PERLIN + width, wrapY: PERLIN + width };
        let x = (px + spec.offset) * freq;
        let y = (py + spec.offset) * freq;
        let sum = 0;
        let ratio = 1;
        for (let octave = 0; octave < spec.octaves; octave++) {
          sum += noise2(channel, x, y, stitch) / ratio;
          x *= 2;
          y *= 2;
          ratio *= 2;
          stitch.width *= 2;
          stitch.wrapX = 2 * stitch.wrapX - PERLIN;
          stitch.height *= 2;
          stitch.wrapY = 2 * stitch.wrapY - PERLIN;
        }
        out[(py * size + px) * 4 + channel] = Math.round((sum * 255 + 255) / 2);
      }
    }
  }
  return out;
}
