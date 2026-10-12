export const POSTER_GLASS_MODEL = String.raw`
const POSTER_ASPECT = 0.7;
const POSTER_HEIGHT = 0.86;
const POSTER_WIDTH = 0.84;
const POSTER_LIFT = 0.012;
const TYPE_MARGIN = 0.055;
const TYPE_LEADING = 0.9;
const TYPE_ASCENT = 0.72;
const TYPE_DESCENT = 0.16;
const HEADLINE_MAX = 0.4;
const HEADLINE_GAP = 0.05;
const MELT = 0.05;
const DETACH_SWAY = 0.35;
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

const BLOCKS = [
  { role: 'intro', x: TYPE_MARGIN, top: TYPE_MARGIN, size: 0.036, align: 'left' },
  { role: 'details', x: 0.52, top: TYPE_MARGIN, size: 0.036, align: 'left' },
  { role: 'dates', x: 0.4, top: 0.6, size: 0.17, align: 'left' },
  { role: 'venue', x: TYPE_MARGIN, bottom: 1 / POSTER_ASPECT - TYPE_MARGIN, size: 0.068, align: 'left' },
  { role: 'footer', x: 1 - TYPE_MARGIN, bottom: 1 / POSTER_ASPECT - TYPE_MARGIN, size: 0.036, align: 'right' }
];

const DROPS = [
  [2, -0.35, 0.12, 0.05, 1],
  [4, Math.PI, 0.13, 0.042, 2],
  [5, 2.3, 0.15, 0.055, 1],
  [8, 0.3, 0.13, 0.04, 2],
  [6, 0.2, 0.11, 0.025, 1],
  [9, 1.9, 0.11, 0.022, 2]
];

const BODY_COUNT = BLOB_BASE.length;

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

function fittedSize(lines, room, size, widthEm) {
  const widest = lines.reduce((m, l) => Math.max(m, widthEm(l.text)), 1e-6);
  return Math.min(size, room / widest);
}

function blockLines(spec, lines, size, poster) {
  const line = size * TYPE_LEADING;
  const first = spec.top !== undefined ? spec.top * poster.w + size * TYPE_ASCENT : spec.bottom * poster.w - size * TYPE_DESCENT - (lines.length - 1) * line;
  return lines.map((l, i) => ({ role: spec.role, text: l.text, muted: l.muted, align: spec.align, size, x: poster.x + spec.x * poster.w, y: poster.y + first + i * line }));
}

function posterBlocks(p, poster, widthEm) {
  const intro = BLOCKS[0];
  const room = (spec) => (spec.align === 'left' ? 1 - TYPE_MARGIN - spec.x : spec.x - TYPE_MARGIN) * poster.w;
  const placed = BLOCKS.flatMap((spec) => {
    const lines = columnLines(p[spec.role]).filter((l) => l.text);
    return blockLines(spec, lines, fittedSize(lines, room(spec), spec.size * poster.w, widthEm), poster);
  });
  const word = String(p.headline || '').trim();
  const introRows = Math.max(columnLines(p.intro).length, columnLines(p.details).length);
  const top = (intro.top + introRows * intro.size * TYPE_LEADING + HEADLINE_GAP) * poster.w;
  const size = Math.min(HEADLINE_MAX * poster.w, ((1 - 2 * TYPE_MARGIN) * poster.w) / Math.max(widthEm(word), 1e-6));
  const headline = { role: 'headline', text: word, muted: false, align: 'left', size, x: poster.x + TYPE_MARGIN * poster.w, y: poster.y + top + size * TYPE_ASCENT };
  return [headline, ...placed];
}

function dropPhase(seed, i) {
  const v = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function smooth(x) {
  return x * x * (3 - 2 * x);
}

function blobNodes(p, t, length) {
  const u = t / Math.max(length, 1e-6);
  const flow = Math.max(1, Math.round(p.flow));
  const body = BLOB_BASE.map(([x, y, r, reach], i) => {
    const [fx, fy] = BLOB_CYCLES[i];
    const swing = reach * p.wander;
    const phase = i * RIPPLE;
    return [
      x + swing * Math.sin(TAU * u * fx * flow + phase),
      y + swing * Math.sin(TAU * u * fy * flow - phase * 1.3),
      r * p.glassSize * (1 + BREATH * Math.sin(TAU * u * 2 * flow - phase))
    ];
  });
  const drops = DROPS.map(([anchor, angle, reach, r, cycles], i) => {
    const [ax, ay, ar] = body[anchor];
    const phase = dropPhase(p.seed, i);
    const away = smooth(smooth(0.5 - 0.5 * Math.cos(TAU * (u * cycles * flow + phase))));
    const turn = angle + DETACH_SWAY * Math.sin(TAU * (u + phase));
    const size = r * p.glassSize;
    const reachNow = (ar + reach * p.glassSize) * away + (ar - size) * 0.5 * (1 - away);
    return [ax + Math.cos(turn) * reachNow, ay + Math.sin(turn) * reachNow, size];
  });
  return [...body, ...drops];
}
`;
