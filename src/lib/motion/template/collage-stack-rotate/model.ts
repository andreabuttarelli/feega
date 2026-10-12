import { WORD_ENTRANCE } from '../word-entrance';

export const COLLAGE_MODEL = String.raw`
${WORD_ENTRANCE}
const CARDS = [
  [0.02, -0.04, 0.98, 1.55, -3, 0, 100, -18],
  [0.06, 0.08, 0.92, 1.3, -7, 0, -20, 24],
  [-0.08, -0.12, 0.82, 1.08, -14, 1, 200, -30],
  [0.04, 0.03, 0.74, 1.02, -9.5, 0, 60, 20],
  [0.03, 0.02, 0.62, 0.78, 34, 1, -60, 40],
  [0.05, 0.0, 0.42, 0.52, 27, 1, 150, -26],
  [-0.06, -0.03, 0.3, 0.2, -6, 0, 250, 30],
  [0.12, 0.22, 0.36, 0.46, 12, 1, 20, -22],
  [-0.2, -0.26, 0.4, 0.3, -20, 0, 210, 26],
  [0.16, -0.3, 0.32, 0.42, 18, 1, 300, -30]
];
const COLUMNS = [0.007, 0.22, 0.49, 0.8];
const ROWS = [0.19, 0.37, 0.55, 0.73];
const FILLED = [[0, 1, 2], [2, 3], [0, 1, 2], [2, 3]];
const LINES = [0.11, 0.29, 0.47, 0.65, 0.83];
const TALL_SHARE = 0.6;
const ENTER = 1.4;
const EXIT = 1.3;
const EXIT_STAGGER = 0.08;
const OFF_MARGIN = 1.04;
const NUDGE = 1.2;
const SINK = 0.012;
const CELL_GAP = 0.09;
const CELL_IN = 0.7;
const CELL_RISE = 0.4;
const LINE_IN = 1.2;
const LINE_GAP = 0.06;
const END_HOLD = 0.05;
const DEFAULT_LABELS = 'Unknown, @fennel';

const hash01 = (i, salt) => {
  let h = Math.imul(i + 1, 374761393) ^ Math.imul(salt + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
const fakeId = (i) => 'FE/I/' + Array.from({ length: 7 }, (_, k) => ID_CHARS[Math.floor(hash01(i, k + 11) * ID_CHARS.length)]).join('');

function labelRows(raw, count) {
  const pairs = String(raw || DEFAULT_LABELS).split(/\n|;/).map((line) => line.split(',').map((s) => s.trim())).filter((pair) => pair[0]);
  const list = pairs.length ? pairs : [DEFAULT_LABELS.split(', ')];
  return Array.from({ length: count }, (_, i) => {
    const [creator, saver] = list[i % list.length];
    return ['ID ' + fakeId(i), 'CREATED BY ' + creator.toUpperCase(), 'SAVED BY ' + String(saver || '@anon').toUpperCase()];
  });
}

function offDistance(card, dir, halfW, halfH) {
  const r = Math.hypot(card.w, card.h) / 2;
  const toX = Math.abs(dir.x) > 1e-3 ? (halfW + r + Math.abs(card.x)) / Math.abs(dir.x) : Infinity;
  const toY = Math.abs(dir.y) > 1e-3 ? (halfH + r + Math.abs(card.y)) / Math.abs(dir.y) : Infinity;
  return Math.min(toX, toY) * OFF_MARGIN;
}

function collageLayout(p, width, height) {
  const unit = Math.min(width, height * TALL_SHARE);
  const halfW = width / unit / 2;
  const halfH = height / unit / 2;
  const n = Math.max(1, Math.min(CARDS.length, Math.round(p.count)));
  const cards = CARDS.slice(0, n).map(([x, y, w, h, rot, print, from, turn], i) => {
    const angle = (from * Math.PI) / 180;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    const card = { i, x, y, w: w * p.cardScale, h: h * p.cardScale, rot, print: print === 1, turn, dir, nudge: -Math.sign(turn) * NUDGE };
    return { ...card, travel: offDistance(card, dir, halfW, halfH) };
  });
  const cells = FILLED.flatMap((cols, r) => cols.map((c) => ({ x: COLUMNS[c], y: ROWS[r] })));
  return { unit, cards, cells, lines: LINES };
}

function cardFrame(card, cards, p, t, length) {
  const at = p.cardsAt + card.i * p.gap;
  const enter = expoInOut(span(t, at, ENTER));
  const later = cards.slice(card.i + 1).reduce((sum, other) => sum + expoInOut(span(t, p.cardsAt + other.i * p.gap, ENTER)), 0);
  const exit = p.leave ? expoInOut(span(t, length - EXIT - card.i * EXIT_STAGGER, EXIT)) : 0;
  const away = card.travel * (1 - enter) - card.travel * exit;
  return {
    x: card.x + card.dir.x * away,
    y: card.y + card.dir.y * away,
    rot: card.rot + card.turn * (1 - enter) - card.turn * exit + card.nudge * later,
    scale: 1 - SINK * later,
    opacity: enter > 0 && exit < 1 ? 1 : 0
  };
}

function cellFrame(k, p, t, length) {
  const shown = smooth(span(t, p.labelsAt + k * CELL_GAP, CELL_IN));
  const rise = landSoftly(span(t, p.labelsAt + k * CELL_GAP, CELL_IN * 1.4));
  const gone = p.leave ? smooth(span(t, length - EXIT - 0.3 + k * 0.02, EXIT * 0.7)) : 0;
  return { opacity: shown * (1 - gone), y: CELL_RISE * (1 - rise) };
}

function lineFrame(r, p, t, length) {
  const grow = expoInOut(span(t, p.labelsAt - 0.4 + r * LINE_GAP, LINE_IN));
  const shrink = p.leave ? expoInOut(span(t, length - END_HOLD - LINE_IN - (LINES.length - 1 - r) * LINE_GAP, LINE_IN)) : 0;
  return grow * (1 - shrink);
}

function collageFrame(layout, p, t, length) {
  return {
    cards: layout.cards.map((card) => cardFrame(card, layout.cards, p, t, length)),
    cells: layout.cells.map((_, k) => cellFrame(k, p, t, length)),
    lines: layout.lines.map((_, r) => lineFrame(r, p, t, length)),
    drift: (t / length) % 1
  };
}
`;
