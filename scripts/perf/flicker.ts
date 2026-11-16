export type Gray = { width: number; height: number; data: Uint8Array };

const GRID = [12, 8] as const;
const INK_STEP = 24;
const INKED = 0.15;
const DROPPED = 0.4;
const ZOOM_MIN = 0.67;
const ZOOM_MAX = 1.5;
const ZOOM_STEP = 1.005;
const SHIFT_PX = 6;
const SAMPLE_EVERY = 3;

type Move = { zoom: number; dx: number; dy: number };

function paperOf(g: Gray): number {
  const counts = new Uint32Array(256);
  g.data.forEach((v) => counts[v]++);
  return counts.indexOf(Math.max(...counts));
}

function moved(from: Gray, { zoom, dx, dy }: Move, paper: number): Gray {
  const { width, height } = from;
  const [cx, cy] = [width / 2, height / 2];
  const data = new Uint8Array(width * height).fill(paper);
  for (let y = 0; y < height; y++) {
    const sy = Math.floor(cy + (y + 0.5 - dy - cy) / zoom);
    if (sy < 0 || sy >= height) {
      continue;
    }
    for (let x = 0; x < width; x++) {
      const sx = Math.floor(cx + (x + 0.5 - dx - cx) / zoom);
      if (sx >= 0 && sx < width) {
        data[y * width + x] = from.data[sy * width + sx];
      }
    }
  }
  return { width, height, data };
}

function mismatch(from: Gray, to: Gray, { zoom, dx, dy }: Move, paper: number): number {
  const { width, height } = to;
  const [cx, cy] = [width / 2, height / 2];
  let sum = 0;
  for (let y = 0; y < height; y += SAMPLE_EVERY) {
    const sy = Math.floor(cy + (y + 0.5 - dy - cy) / zoom);
    for (let x = 0; x < width; x += SAMPLE_EVERY) {
      const sx = Math.floor(cx + (x + 0.5 - dx - cx) / zoom);
      const seen = sx >= 0 && sx < width && sy >= 0 && sy < height ? from.data[sy * width + sx] : paper;
      sum += Math.abs(seen - to.data[y * width + x]);
    }
  }
  return sum;
}

function aligned(from: Gray, to: Gray, paper: number): Gray {
  let best = { error: Infinity, move: { zoom: 1, dx: 0, dy: 0 } };
  for (let zoom = ZOOM_MIN; zoom <= ZOOM_MAX; zoom *= ZOOM_STEP) {
    for (let dx = -SHIFT_PX; dx <= SHIFT_PX; dx++) {
      for (let dy = -SHIFT_PX; dy <= SHIFT_PX; dy++) {
        const move = { zoom, dx, dy };
        const error = mismatch(from, to, move, paper);
        if (error < best.error) {
          best = { error, move };
        }
      }
    }
  }
  return moved(from, best.move, paper);
}

function cells(g: Gray, paper: number): number[] {
  const [gw, gh] = GRID;
  const out = new Array(gw * gh).fill(0);
  const per = (g.width / gw) * (g.height / gh);
  for (let y = 0; y < g.height; y++) {
    for (let x = 0; x < g.width; x++) {
      const ink = Math.abs(g.data[y * g.width + x] - paper) > INK_STEP;
      out[Math.floor((y * gh) / g.height) * gw + Math.floor((x * gw) / g.width)] += ink ? 1 / per : 0;
    }
  }
  return out;
}

export function vanishes(a: Gray, b: Gray, c: Gray): boolean {
  const paper = paperOf(b);
  const seen = [aligned(a, b, paper), aligned(c, b, paper)].map((g) => cells(g, paper));
  const now = cells(b, paper);
  return now.some((v, i) => {
    const before = Math.min(...seen.map((s) => s[i]));
    return before > INKED && v < DROPPED * before;
  });
}

export function inkOf(rgb: Uint8Array, width: number, height: number, channels: number): Gray {
  const counts = new Map<number, number>();
  for (let i = 0; i < rgb.length; i += channels) {
    const key = (rgb[i] << 16) | (rgb[i + 1] << 8) | rgb[i + 2];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const paper = [...counts].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const [pr, pg, pb] = [paper >> 16, (paper >> 8) & 255, paper & 255];
  const data = new Uint8Array(width * height);
  for (let p = 0, i = 0; p < data.length; p++, i += channels) {
    data[p] = Math.min(255, Math.abs(rgb[i] - pr) + Math.abs(rgb[i + 1] - pg) + Math.abs(rgb[i + 2] - pb));
  }
  return { width, height, data };
}
