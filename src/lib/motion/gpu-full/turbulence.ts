const SIZE = 0x100;
export const LATTICE = SIZE + SIZE + 2;
const CHANNELS = 4;
const RAND_M = 2147483647;
const RAND_A = 16807;
const RAND_Q = 127773;
const RAND_R = 2836;

export type Lattice = { selector: Int32Array; gradients: Float32Array };

function seeded(seed: number): number {
  const s = seed <= 0 ? -(seed % (RAND_M - 1)) + 1 : seed;
  return Math.min(s, RAND_M - 1);
}

function next(seed: number): number {
  const r = RAND_A * (seed % RAND_Q) - RAND_R * Math.floor(seed / RAND_Q);
  return r <= 0 ? r + RAND_M : r;
}

export function latticeOf(seed: number): Lattice {
  let s = seeded(Math.trunc(seed));
  const selector = new Int32Array(LATTICE);
  const gradients = new Float32Array(CHANNELS * LATTICE * 2);
  const g = (k: number, i: number, j: number) => (k * LATTICE + i) * 2 + j;
  for (let k = 0; k < CHANNELS; k++) {
    for (let i = 0; i < SIZE; i++) {
      selector[i] = i;
      for (let j = 0; j < 2; j++) {
        s = next(s);
        gradients[g(k, i, j)] = ((s % (SIZE + SIZE)) - SIZE) / SIZE;
      }
      const len = Math.hypot(gradients[g(k, i, 0)], gradients[g(k, i, 1)]);
      gradients[g(k, i, 0)] /= len;
      gradients[g(k, i, 1)] /= len;
    }
  }
  for (let i = SIZE - 1; i > 0; i--) {
    const kept = selector[i];
    s = next(s);
    const j = s % SIZE;
    selector[i] = selector[j];
    selector[j] = kept;
  }
  for (let i = 0; i < SIZE + 2; i++) {
    selector[SIZE + i] = selector[i];
    for (let k = 0; k < CHANNELS; k++) {
      for (let j = 0; j < 2; j++) {
        gradients[g(k, SIZE + i, j)] = gradients[g(k, i, j)];
      }
    }
  }
  return { selector, gradients };
}

export function stitchedFrequency(base: number, tile: number): number {
  if (base === 0) {
    return 0;
  }
  const lo = Math.floor(tile * base) / tile;
  const hi = Math.ceil(tile * base) / tile;
  return base / lo < hi / base ? lo : hi;
}
