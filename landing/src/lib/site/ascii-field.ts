export const RAMP = ' .:-=+*#%@';

export const MAX_CELLS = 12000;

type Rgb = [number, number, number];

const PRIDE_RAINBOW = ['#E40303', '#FF8C00', '#FFED00', '#008026', '#004DFF', '#750787'];

const MIN_PEAK = 200;

const parse = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;

function lifted(rgb: Rgb): Rgb {
  const gain = Math.max(1, MIN_PEAK / Math.max(...rgb));
  return rgb.map((v) => Math.min(255, Math.round(v * gain))) as Rgb;
}

const STOPS: Rgb[] = PRIDE_RAINBOW.map(parse);

const PRIDE_FLAGS = [
  PRIDE_RAINBOW,
  ['#5BCEFA', '#F5A9B8', '#FFFFFF', '#F5A9B8', '#5BCEFA'],
  ['#D52D00', '#EF7627', '#FF9A56', '#FFFFFF', '#D162A4', '#B55690', '#A30262'],
  ['#D60270', '#D60270', '#9B4F96', '#0038A8', '#0038A8'],
  ['#FF218C', '#FFD800', '#21B1FF'],
  ['#FCF434', '#FFFFFF', '#9C59D1', '#2C2C2C'],
  ['#000000', '#A3A3A3', '#FFFFFF', '#800080']
];

const DARK_PEAK = 60;

const visibleStops = (stripes: string[]) =>
  stripes.map(parse).filter((rgb) => Math.max(...rgb) > DARK_PEAK);

const FLAG_STOPS: Rgb[][] = PRIDE_FLAGS.map(visibleStops);

export const FLAG_COUNT = FLAG_STOPS.length;

export const FLAG_HOLD_MS = 9000;

export const FLAG_FADE_MS = 1500;

const easeInOutExpo = (x: number) =>
  x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2;

export function flagTint(t: number, clockMs: number, startFlag: number): Rgb {
  const step = Math.floor(clockMs / FLAG_HOLD_MS);
  const local = clockMs - step * FLAG_HOLD_MS;
  const mix = easeInOutExpo((local - (FLAG_HOLD_MS - FLAG_FADE_MS)) / FLAG_FADE_MS);
  const from = gradient(FLAG_STOPS[(startFlag + step) % FLAG_COUNT], t);
  const to = gradient(FLAG_STOPS[(startFlag + step + 1) % FLAG_COUNT], t);
  return lifted([0, 1, 2].map((k) => from[k] + (to[k] - from[k]) * mix) as Rgb);
}

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

function gradient(stops: Rgb[], t: number): Rgb {
  const p = Math.min(1, Math.max(0, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(p));
  const f = p - i;
  const [a, b] = [stops[i], stops[i + 1]];
  return [0, 1, 2].map((k) => a[k] + (b[k] - a[k]) * f) as Rgb;
}

export function tint(t: number): Rgb {
  return lifted(gradient(STOPS, t));
}

export function envelope(nx: number, ny: number): number {
  const dx = (nx - 0.5) * 2;
  const dy = (ny - 0.5) * 2;
  const r = Math.min(1, Math.hypot(dx, dy) / Math.SQRT2);
  return 1 - r * r * (3 - 2 * r);
}
