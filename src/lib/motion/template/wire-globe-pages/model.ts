export const WIRE_MODEL = String.raw`
const MIN_PAGES = 6;
const MAX_PAGES = 40;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const LEVELS = [0.95, 0.76, 0.57];
const FILL = 0.66;
const MAX_FILL = 0.86;
const SIZE_JITTER = 0.18;
const ASPECT_JITTER = 0.12;
const ROLL_JITTER = 0.9;
const DEG = Math.PI / 180;

const hash = (i, k) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function shellDirections(m, level) {
  const shift = (level / LEVELS.length) * GOLDEN_ANGLE;
  const lift = (level / LEVELS.length - 0.5) / m;
  return Array.from({ length: m }, (_, j) => ({ lat: Math.asin(1 - (2 * (j + 0.5 + lift)) / m), lon: j * GOLDEN_ANGLE + shift }));
}

const arc = (a, b) => Math.acos(Math.max(-1, Math.min(1, Math.sin(a.lat) * Math.sin(b.lat) + Math.cos(a.lat) * Math.cos(b.lat) * Math.cos(a.lon - b.lon))));

function nearest(points) {
  return points.map((a, i) => Math.min(Math.PI, ...points.filter((_, j) => j !== i).map((b) => arc(a, b))));
}

function pageLayout(p) {
  const n = Math.max(MIN_PAGES, Math.min(MAX_PAGES, Math.round(p.pages)));
  const fill = Math.min(MAX_FILL, FILL * p.pageSize);
  return LEVELS.flatMap((r, level) => {
    const slots = Array.from({ length: n }, (_, i) => i).filter((i) => i % LEVELS.length === level);
    const points = shellDirections(slots.length, level);
    const spacing = Math.min(...nearest(points));
    return slots.map((slot, j) => {
      const aspect = p.pageAspect * (1 + (hash(slot, 2) - 0.5) * ASPECT_JITTER);
      const reach = (spacing / 2) * fill * (1 - hash(slot, 1) * SIZE_JITTER);
      const diag = Math.tan(reach);
      const tw = (diag * Math.sqrt(aspect)) / Math.sqrt(aspect + 1 / aspect);
      const th = (diag / Math.sqrt(aspect)) / Math.sqrt(aspect + 1 / aspect);
      return { ...points[j], roll: (hash(slot, 5) - 0.5) * ROLL_JITTER, w: 2 * Math.atan(tw), h: 2 * Math.atan(th), r, slot };
    });
  }).sort((a, b) => a.slot - b.slot);
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
