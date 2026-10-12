import { WORD_ENTRANCE } from '../word-entrance';

export const MELT_MODEL = String.raw`
${WORD_ENTRANCE}
const PAGE_ASPECT = 3 / 4;
const FLOOR_MARGIN = 0.012;
const SWEEP_SLOPE = 0.7;
const NOISE_CELL = 22;
const GRAIN_JITTER = 0.06;
const DRIFT_JITTER = 3;
const RISE = 2;
const RISE_SPREAD = 2.6;
const END_HOLD = 0.4;
const TOPPLE_LIMIT = 4096;

const hash01 = (i, salt) => {
  let h = Math.imul(i + 1, 374761393) ^ Math.imul(salt + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const cellNoise = (x, y, salt) => {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  const fx = smooth(x - cx);
  const fy = smooth(y - cy);
  const at = (i, j) => hash01(i * 7919 + j * 104729, salt);
  const top = at(cx, cy) * (1 - fx) + at(cx + 1, cy) * fx;
  const bottom = at(cx, cy + 1) * (1 - fx) + at(cx + 1, cy + 1) * fx;
  return top * (1 - fy) + bottom * fy;
};

function pageBox(width, height, margin) {
  const room = { w: width * (1 - 2 * margin), h: height * (1 - 2 * margin) };
  const h = Math.min(room.h, room.w / PAGE_ASPECT);
  const w = h * PAGE_ASPECT;
  return { x: (width - w) / 2, y: (height - h) / 2, w, h };
}

function releaseOf(x, y, rows, p, i) {
  const noise = cellNoise(x / NOISE_CELL, y / NOISE_CELL, 1) * 0.7 + cellNoise(x / (NOISE_CELL / 4), y / (NOISE_CELL / 4), 2) * 0.3;
  const front = SWEEP_SLOPE * ((y - rows.top) / Math.max(1, rows.bottom - rows.top)) + (1 - SWEEP_SLOPE) * noise;
  return p.meltAt + p.spread * clamp01(front + GRAIN_JITTER * (hash01(i, 3) - 0.5));
}

function topple(heights, column, i) {
  let c = column;
  for (let k = 0; k < TOPPLE_LIMIT; k++) {
    const left = c > 0 && heights[c - 1] < heights[c];
    const right = c < heights.length - 1 && heights[c + 1] < heights[c];
    if (!left && !right) {
      return c;
    }
    c += left && right ? (hash01(i + k, 5) < 0.5 ? -1 : 1) : left ? -1 : 1;
  }
  return c;
}

function sandGrains(alpha, w, h, p, length) {
  const ids = [];
  for (let k = 0; k < w * h; k++) {
    if (alpha[k] > 0) {
      ids.push(k);
    }
  }
  const count = ids.length;
  const g = {
    count, h,
    x0: new Float32Array(count), y0: new Float32Array(count), a: new Uint8Array(count),
    release: new Float32Array(count), fall: new Float32Array(count), riseAt: new Float32Array(count),
    xr: new Float32Array(count), yr: new Float32Array(count)
  };
  const rows = { top: count ? Math.floor(ids[0] / w) : 0, bottom: count ? Math.floor(ids[count - 1] / w) : 0 };
  const floor = h - 1 - Math.round(h * FLOOR_MARGIN);
  ids.forEach((k, i) => {
    const x = k % w;
    const y = (k - x) / w;
    g.x0[i] = x;
    g.y0[i] = y;
    g.a[i] = alpha[k];
    g.release[i] = hash01(i, 4) < p.strength ? releaseOf(x, y, rows, p, i) : Infinity;
  });
  const order = Array.from({ length: count }, (_, i) => i).sort((m, n) => g.release[m] - g.release[n] || m - n);
  const heights = new Int32Array(w);
  const first = p.meltAt;
  const last = p.meltAt + Math.max(p.spread, 1e-6);
  order.forEach((i) => {
    if (g.release[i] === Infinity) {
      g.xr[i] = g.x0[i];
      g.yr[i] = g.y0[i];
      g.riseAt[i] = Infinity;
      return;
    }
    const drift = p.wind * (floor - g.y0[i]) + DRIFT_JITTER * (hash01(i, 6) - 0.5);
    const c = topple(heights, Math.min(w - 1, Math.max(0, Math.round(g.x0[i] + drift))), i);
    g.xr[i] = c;
    g.yr[i] = floor - heights[c];
    heights[c]++;
    g.fall[i] = Math.sqrt((2 * Math.max(1, Math.abs(g.yr[i] - g.y0[i]))) / (p.gravity * h));
    const rank = clamp01((g.release[i] - first) / (last - first));
    g.riseAt[i] = length - END_HOLD - RISE - RISE_SPREAD * rank;
  });
  return g;
}

function fallen(g, i, t) {
  const u = span(t, g.release[i], g.fall[i]);
  return [g.x0[i] + (g.xr[i] - g.x0[i]) * u, g.y0[i] + (g.yr[i] - g.y0[i]) * u * u];
}

function grainAt(g, i, t) {
  if (!(t > g.release[i])) {
    return [g.x0[i], g.y0[i]];
  }
  if (t <= g.riseAt[i]) {
    return fallen(g, i, t);
  }
  const u = expoInOut(span(t, g.riseAt[i], RISE));
  if (u >= 1) {
    return [g.x0[i], g.y0[i]];
  }
  const [x, y] = fallen(g, i, g.riseAt[i]);
  return [x + (g.x0[i] - x) * u, y + (g.y0[i] - y) * u];
}
`;
