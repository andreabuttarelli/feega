export const RAMP = ' .:-=+*#%@';

export const MAX_CELLS = 12000;

type Rgb = [number, number, number];

const STOPS: Rgb[] = [
  [255, 81, 0],
  [255, 140, 70],
  [220, 120, 190],
  [140, 150, 255]
];

const WAVES = [
  { kx: 0.11, ky: 0.07, r: 1.6, off: 0 },
  { kx: -0.06, ky: 0.13, r: 1.2, off: 1.7 },
  { kx: 0.04, ky: -0.09, r: 2.1, off: 3.1 }
];

const TAU = Math.PI * 2;

export function fieldAt(x: number, y: number, phase: number): number {
  const a = phase * TAU;
  const cx = Math.cos(a);
  const sy = Math.sin(a);

  let sum = 0;
  for (const w of WAVES) {
    const warp = Math.sin(y * 0.05 + w.r * sy + w.off) * 2;
    sum += Math.sin((x + warp) * w.kx + y * w.ky + w.r * cx + w.off);
  }

  return (sum / WAVES.length + 1) / 2;
}

export function glyphFor(density: number): string {
  const i = Math.round(Math.min(1, Math.max(0, density)) * (RAMP.length - 1));
  return RAMP[i];
}

export function gridSize(width: number, height: number, cell: number) {
  let size = cell;
  while (Math.ceil(width / size) * Math.ceil(height / size) > MAX_CELLS) {
    size += 1;
  }

  return { cols: Math.ceil(width / size), rows: Math.ceil(height / size), cell: size };
}

export function tint(t: number): Rgb {
  const p = Math.min(1, Math.max(0, t)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(p));
  const f = p - i;
  const [a, b] = [STOPS[i], STOPS[i + 1]];
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)) as Rgb;
}

export function envelope(nx: number, ny: number): number {
  const dx = (nx - 0.5) * 2;
  const dy = (ny - 0.5) * 2;
  const r = Math.min(1, Math.hypot(dx, dy) / Math.SQRT2);
  return 1 - r * r * (3 - 2 * r);
}
