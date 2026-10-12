import { WORD_ENTRANCE } from '../word-entrance';

export const PAPER_MODEL = String.raw`
${WORD_ENTRANCE}
const MIN_LINES = 2;
const MAX_LINES = 9;
const CURVE = 1.35;
const ROUND_TO = 100;
const FIRST_RATIO = 0.42;
const CHAR_W = 0.6;
const LEADING = 1.12;
const LINE_IN = 1.0;
const LINE_FADE = 0.35;
const LINE_RISE = 0.35;
const ROLL = 0.8;
const EXIT = 0.9;
const EXIT_GAP = 0.4;
const EXIT_RISE = 0.25;
const SKETCH_AT = 0.6;
const SKETCH_DRAW = 2.6;
const SKETCH_BACK = 1.2;
const SKETCH_GAP = 0.5;
const TILT = 0.55;
const JITTER = 0.32;
const DEG = Math.PI / 180;
const LIGHT = (() => { const v = [-0.5, -0.65, 1]; const l = Math.hypot(...v); return v.map((c) => c / l); })();
const SWAY = { ry: 7, rx: 4, rz: 1.5, y: 0.012 };

const LAYOUTS = {
  wide: [
    { kind: 'cutout', x: -0.43, y: -0.01, w: 0.5, h: 0.56, z: 0 },
    { kind: 'panel', x: 0.02, y: 0.02, w: 0.5, h: 0.64, z: 0.1 },
    { kind: 'paper', x: 0.56, y: 0.03, w: 0.44, h: 0.54, z: 0 }
  ],
  square: [
    { kind: 'cutout', x: -0.26, y: -0.2, w: 0.36, h: 0.4, z: 0 },
    { kind: 'panel', x: 0.02, y: 0.04, w: 0.38, h: 0.52, z: 0.1 },
    { kind: 'paper', x: 0.27, y: 0.2, w: 0.34, h: 0.4, z: 0 }
  ],
  tall: [
    { kind: 'cutout', x: -0.18, y: -0.5, w: 0.5, h: 0.5, z: 0 },
    { kind: 'panel', x: 0.0, y: 0.0, w: 0.6, h: 0.8, z: 0.1 },
    { kind: 'paper', x: 0.18, y: 0.52, w: 0.5, h: 0.48, z: 0 }
  ]
};

const BASE_POSE = {
  cutout: { ry: 22, rx: 2, rz: -6 },
  panel: { ry: -16, rx: 4, rz: -6 },
  paper: { ry: -20, rx: -2, rz: 4 }
};

function paperLayout(aspect) {
  const shape = aspect >= 1.3 ? 'wide' : aspect > 0.8 ? 'square' : 'tall';
  return LAYOUTS[shape].map((c) => ({ ...c }));
}

const lineCount = (p) => Math.max(MIN_LINES, Math.min(MAX_LINES, Math.round(Number(p.lines) || MIN_LINES)));

function counterValues(p) {
  const n = lineCount(p);
  const from = Number(p.from) || 0;
  const to = Number(p.to) || 0;
  return Array.from({ length: n }, (_, i) => {
    const k = i / (n - 1);
    const v = from + (to - from) * (1 - Math.pow(1 - k, CURVE));
    return i === 0 || i === n - 1 ? v : Math.round(v / ROUND_TO) * ROUND_TO;
  });
}

function counterSizes(count, width, height, chars) {
  const rel = Array.from({ length: count }, (_, i) => Math.pow(FIRST_RATIO, (count - 1 - i) / Math.max(1, count - 1)));
  const total = rel.reduce((a, b) => a + b, 0);
  const last = Math.min(width / (Math.max(1, chars) * CHAR_W), height / (LEADING * total));
  return rel.map((r) => r * last);
}

const grouped = (v) => String(Math.round(Math.abs(v))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const money = (prefix, v) => (v < 0 ? '-' : '') + String(prefix || '') + grouped(v);

function counterFrame(p, t, length) {
  const values = counterValues(p);
  const out = smooth(span(t, length - EXIT - EXIT_GAP, EXIT));
  return values.map((v, i) => {
    const at = p.startAt + i * p.lineSeconds;
    const progress = landSoftly(span(t, at, LINE_IN));
    const from = i === 0 ? v : values[i - 1];
    const shown = from + (v - from) * expoInOut(span(t, at, ROLL));
    return {
      text: money(p.prefix, i === 0 ? v : Math.round(shown / ROUND_TO) * ROUND_TO),
      opacity: smooth(span(t, at, LINE_FADE)) * (1 - out),
      rise: LINE_RISE * (1 - progress) - EXIT_RISE * out
    };
  });
}

function cardPose(card, i, t, length) {
  const base = BASE_POSE[card.kind];
  const w = 2 * Math.PI * ((t / length) % 1);
  const ph = i * 2.1;
  return {
    x: card.x,
    y: card.y + SWAY.y * Math.sin(2 * w + ph),
    ry: base.ry + SWAY.ry * Math.sin(w + ph),
    rx: base.rx + SWAY.rx * Math.sin(2 * w + ph * 1.3),
    rz: base.rz + SWAY.rz * Math.sin(w + ph * 0.7)
  };
}

function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function crumple(seed, cols, rows) {
  const r = rng(seed);
  const grid = Array.from({ length: rows + 1 }, (_, j) => Array.from({ length: cols + 1 }, (_, i) => {
    const inside = i > 0 && i < cols && j > 0 && j < rows;
    const dx = inside ? (r() - 0.5) * 2 * JITTER : 0;
    const dy = inside ? (r() - 0.5) * 2 * JITTER : 0;
    return [((i + dx) / cols) * 100, ((j + dy) / rows) * 100];
  }));
  const normal = () => {
    const v = [(r() - 0.5) * 2 * TILT, (r() - 0.5) * 2 * TILT, 1];
    const l = Math.hypot(...v);
    return v.map((c) => c / l);
  };
  const facets = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const a = grid[j][i];
      const b = grid[j][i + 1];
      const c = grid[j + 1][i + 1];
      const d = grid[j + 1][i];
      const pair = r() < 0.5 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
      pair.forEach((points) => facets.push({ points, normal: normal() }));
    }
  }
  return facets;
}

function rotate(v, pose) {
  const [a, b, c] = [pose.ry * DEG, pose.rx * DEG, pose.rz * DEG];
  const z1 = [v[0] * Math.cos(c) - v[1] * Math.sin(c), v[0] * Math.sin(c) + v[1] * Math.cos(c), v[2]];
  const x1 = [z1[0], z1[1] * Math.cos(b) - z1[2] * Math.sin(b), z1[1] * Math.sin(b) + z1[2] * Math.cos(b)];
  return [x1[0] * Math.cos(a) + x1[2] * Math.sin(a), x1[1], -x1[0] * Math.sin(a) + x1[2] * Math.cos(a)];
}

const lit = (v) => v[0] * LIGHT[0] + v[1] * LIGHT[1] + v[2] * LIGHT[2];

function facetShade(normal, pose) {
  return lit(rotate(normal, pose)) - lit(rotate([0, 0, 1], pose));
}

function paperEdge(seed, count, rough) {
  const r = rng(seed);
  return Array.from({ length: count }, (_, i) => {
    const th = (2 * Math.PI * (i + (r() - 0.5) * 0.6)) / count;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const k = 1 - rough * r();
    const x = Math.sign(c) * Math.pow(Math.abs(c), 0.55) * k;
    const y = Math.sign(s) * Math.pow(Math.abs(s), 0.55) * k;
    return [Math.min(100, Math.max(0, 50 + 50 * x)), Math.min(100, Math.max(0, 50 + 50 * y))];
  });
}

function sketchDrawn(t, length) {
  return smooth(span(t, SKETCH_AT, SKETCH_DRAW)) * (1 - smooth(span(t, length - SKETCH_BACK - SKETCH_GAP, SKETCH_BACK)));
}
`;
