export const WIRE_MODEL = String.raw`
const MIN_PAGES = 6;
const MAX_PAGES = 40;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const COVERAGE = 1.05;
const LAT_JITTER = 0.3;
const LON_JITTER = 0.5;
const SIZE_JITTER = 0.45;
const ASPECT_JITTER = 0.16;
const ROLL_JITTER = 0.9;
const OUTER_PAGE = 0.975;
const LAYER_DEPTH = 0.045;
const POLE = Math.PI / 2 - 0.05;
const DEG = Math.PI / 180;

const hash = (i, k) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function pageLayout(p) {
  const n = Math.max(MIN_PAGES, Math.min(MAX_PAGES, Math.round(p.pages)));
  const side = Math.sqrt((4 * Math.PI) / n) * COVERAGE * p.pageSize;
  return Array.from({ length: n }, (_, i) => {
    const size = side * (1 + (hash(i, 1) - 0.5) * SIZE_JITTER);
    const aspect = p.pageAspect * (1 + (hash(i, 2) - 0.5) * ASPECT_JITTER);
    const lat = Math.asin(1 - (2 * (i + 0.5)) / n) + (hash(i, 3) - 0.5) * LAT_JITTER;
    return {
      lat: Math.max(-POLE, Math.min(POLE, lat)),
      lon: i * GOLDEN_ANGLE + (hash(i, 4) - 0.5) * LON_JITTER,
      roll: (hash(i, 5) - 0.5) * ROLL_JITTER,
      w: size * Math.sqrt(aspect),
      h: size / Math.sqrt(aspect),
      r: OUTER_PAGE - (LAYER_DEPTH * i) / n,
      slot: i
    };
  });
}

function pagePoint(page, u, v) {
  const a = Math.tan((u - 0.5) * page.w);
  const b = Math.tan((v - 0.5) * page.h);
  const k = page.r / Math.sqrt(a * a + b * b + 1);
  const cr = Math.cos(page.roll);
  const sr = Math.sin(page.roll);
  const x0 = (a * cr - b * sr) * k;
  const y0 = (a * sr + b * cr) * k;
  const z0 = k;
  const cl = Math.cos(page.lat);
  const sl = Math.sin(page.lat);
  const y1 = y0 * cl + z0 * sl;
  const z1 = -y0 * sl + z0 * cl;
  const co = Math.cos(page.lon);
  const so = Math.sin(page.lon);
  return [x0 * co + z1 * so, y1, -x0 * so + z1 * co];
}

function wireFrame(p, t, length) {
  const turns = Math.max(0, Math.round(p.turns));
  const phase = (2 * Math.PI * t) / length;
  return { yaw: turns * phase, tilt: p.axisTilt * DEG, pitch: p.sway * DEG * Math.sin(phase) };
}

function facingOf(point, f) {
  const cy = Math.cos(f.yaw);
  const sy = Math.sin(f.yaw);
  const z1 = -point[0] * sy + point[2] * cy;
  const x = f.tilt + f.pitch;
  const length = Math.hypot(point[0], point[1], point[2]) || 1;
  return (point[1] * Math.sin(x) + z1 * Math.cos(x)) / length;
}
`;
