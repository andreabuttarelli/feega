import { WORD_ENTRANCE } from '../word-entrance';

export const PGRID_MODEL = String.raw`
${WORD_ENTRANCE}
const MIN_COLUMNS = 3;
const MAX_COLUMNS = 6;
const GOLDEN = 0.6180339887;
const MOVE_SHARE = 0.78;
const STAGGER_SHARE = 0.2;
const ZOOM_DEPTH = 0.45;
const PUSH = 0.06;
const TITLE_OUT = 1.1;
const VEIL = 0.4;
const VEIL_IN = 1.2;

const ALL_UP = () => -1;
const ODD_DOWN = (i) => (i % 2 ? 1 : -1);
const SPREAD_ALL = (p) => p.spread;
const NO_SPREAD = () => 0;

const MOTIONS = {
  parallax: { dir: ALL_UP, spread: SPREAD_ALL, stagger: 0, depth: 0, push: 0, linear: false },
  alternate: { dir: ODD_DOWN, spread: NO_SPREAD, stagger: 0, depth: 0, push: 0, linear: false },
  stagger: { dir: ALL_UP, spread: NO_SPREAD, stagger: STAGGER_SHARE, depth: 0, push: 0, linear: false },
  zoom: { dir: ALL_UP, spread: SPREAD_ALL, stagger: 0, depth: ZOOM_DEPTH, push: PUSH, linear: false },
  drift: { dir: ALL_UP, spread: NO_SPREAD, stagger: 0, depth: 0, push: 0, linear: true }
};

const motionOf = (p) => MOTIONS[p.motion] || MOTIONS.parallax;
const frac = (x) => x - Math.floor(x);
const rankOf = (i) => frac(i * GOLDEN);
const wrap = (x, period) => x - period * Math.floor(x / period);

function gridLayout(p, aspect) {
  const m = motionOf(p);
  const count = Math.max(MIN_COLUMNS, Math.min(MAX_COLUMNS, Math.round(p.columns)));
  const gap = Math.max(0, p.gap);
  const weights = Array.from({ length: count }, (_, i) => 1 + m.depth * rankOf(i));
  const total = weights.reduce((a, b) => a + b, 0);
  const inner = 1 - gap * (count + 1);
  const cycles = Math.max(1, Math.round(p.speed));
  let x = gap;
  let start = 0;
  return weights.map((weight, i) => {
    const w = (inner * weight) / total;
    const tileH = w / Math.max(0.2, p.tileAspect);
    const pitch = tileH + gap;
    const base = Math.ceil((aspect + gap) / pitch) + 1;
    const n = base + Math.round(m.spread(p) * rankOf(i) * base);
    const column = { x, w, tileH, pitch, n, cycles, dir: m.dir(i), start, delay: count > 1 ? (m.stagger * (i - (count - 1) / 2)) / (count - 1) : 0, phase: rankOf(i + 1) * pitch };
    x += w + gap;
    start += n;
    return column;
  });
}

const segmentsOf = (p) => Math.max(1, Math.round(p.segments));

function loopScroll(p, u, length) {
  if (motionOf(p).linear || p.scroll === 'continuous') {
    return u / length;
  }
  const segments = segmentsOf(p);
  const local = (u / length) * segments;
  const k = Math.floor(local);
  const move = clamp01((local - k - (1 - MOVE_SHARE) / 2) / MOVE_SHARE);
  return (k + expoInOut(move)) / segments;
}

function scrollAt(p, t, length) {
  const loops = Math.floor(t / length);
  return loops + loopScroll(p, t - loops * length, length);
}

function titleFrame(p, t, length) {
  const words = titleWords(p.title);
  if (!p.showTitle) {
    return { words: words.map(() => ({ y: 0, opacity: 0 })), veil: 0 };
  }
  const out = (i) => expoInOut(span(t, length - TITLE_OUT - 0.2 + i * 0.04, TITLE_OUT * 0.8));
  return {
    words: words.map((_, i) => {
      const e = wordIn(t, p.titleAt + i * WORD_GAP);
      return { y: e.rise - 0.1 * out(i), opacity: e.opacity * (1 - smooth(out(i))) };
    }),
    veil: VEIL * smooth(span(t, p.titleAt, VEIL_IN)) * (1 - smooth(out(0)))
  };
}

const titleWords = (title) => String(title || '').trim().split(/\s+/).filter(Boolean);

function columnFrame(c, p, t, length) {
  const period = c.n * c.pitch;
  const shift = (c.delay * length) / segmentsOf(p);
  const progress = scrollAt(p, t - shift, length) - scrollAt(p, -shift, length);
  const travel = c.dir * c.cycles * period * progress;
  const lead = c.pitch;
  const tiles = Array.from({ length: c.n }, (_, j) => ({ y: wrap(j * c.pitch + travel + c.phase + lead, period) - lead, item: c.start + j }));
  return { travel, tiles };
}

function gridFrame(layout, p, t, length) {
  const m = motionOf(p);
  const title = titleFrame(p, t, length);
  return {
    scale: 1 + m.push * (1 - Math.cos((2 * Math.PI * t) / length)) / 2,
    columns: layout.map((c) => columnFrame(c, p, t, length)),
    words: title.words,
    veil: title.veil
  };
}
`;
