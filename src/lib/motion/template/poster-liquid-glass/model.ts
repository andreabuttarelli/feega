export const POSTER_GLASS_MODEL = String.raw`
const POSTER_ASPECT = 0.7;
const POSTER_HEIGHT = 0.86;
const POSTER_WIDTH = 0.84;
const POSTER_LIFT = 0.012;
const TYPE_PAD_X = 0.035;
const TYPE_PAD_Y = 0.02;
const TYPE_LEADING = 0.88;
const MUTED_MARK = '~';
const TAU = Math.PI * 2;
const BREATH = 0.15;
const RIPPLE = 0.8;

const BLOB_BASE = [
  [0.47, 0.085, 0.02, 0.02],
  [0.62, 0.08, 0.025, 0.02],
  [0.72, 0.25, 0.1, 0.025],
  [0.88, 0.38, 0.05, 0.025],
  [0.47, 0.36, 0.08, 0.03],
  [0.45, 0.55, 0.11, 0.03],
  [0.76, 0.54, 0.04, 0.035],
  [0.73, 0.66, 0.035, 0.035],
  [0.52, 0.8, 0.06, 0.03],
  [0.6, 0.98, 0.035, 0.035],
  [0.7, 1.2, 0.022, 0.04],
  [0.2, 0.72, 0.022, 0.04],
  [0.3, 1.04, 0.02, 0.04],
  [0.34, 1.26, 0.018, 0.04]
];

const BLOB_EDGES = [[0, 1], [1, 2], [2, 3], [2, 4], [4, 5], [2, 6], [6, 7], [5, 8], [8, 9], [9, 10], [5, 11], [8, 12], [12, 13]];

const BLOB_CYCLES = [[1, 2], [2, 1], [1, 1], [2, 1], [1, 2], [2, 2], [1, 2], [2, 1], [1, 2], [2, 1], [1, 1], [2, 2], [1, 2], [2, 1]];

function posterBox(width, height) {
  const h = Math.min(height * POSTER_HEIGHT, (width * POSTER_WIDTH) / POSTER_ASPECT);
  const w = h * POSTER_ASPECT;
  return { x: (width - w) / 2, y: (height - h) / 2 - height * POSTER_LIFT, w, h };
}

function columnLines(text) {
  return String(text || '').split('\n').map((raw) => {
    const line = raw.trim();
    const muted = line.startsWith(MUTED_MARK);
    return { text: muted ? line.slice(MUTED_MARK.length).trim() : line, muted };
  });
}

function typeSize(rows, widestEm, poster) {
  const inner = { w: poster.w * (1 - 2 * TYPE_PAD_X), h: poster.h * (1 - 2 * TYPE_PAD_Y) };
  return Math.min(inner.h / (Math.max(1, rows) * TYPE_LEADING), inner.w / Math.max(widestEm, 1e-6));
}

function blobNodes(p, t, length) {
  const u = t / Math.max(length, 1e-6);
  const flow = Math.max(1, Math.round(p.flow));
  return BLOB_BASE.map(([x, y, r, reach], i) => {
    const [fx, fy] = BLOB_CYCLES[i];
    const swing = reach * p.wander;
    const phase = i * RIPPLE;
    return [
      x + swing * Math.sin(TAU * u * fx * flow + phase),
      y + swing * Math.sin(TAU * u * fy * flow - phase * 1.3),
      r * p.glassSize * (1 + BREATH * Math.sin(TAU * u * 2 * flow - phase))
    ];
  });
}
`;
