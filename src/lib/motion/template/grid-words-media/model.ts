import { WORD_ENTRANCE } from '../word-entrance';

export const GRID_MODEL = String.raw`
${WORD_ENTRANCE}
const CHAR_EM = 0.5;
const CHIP_PAD = 0.2;
const EDGE = 1;
const JITTER_MIN = 0.35;
const JITTER = 1.3;
const FAR = 6;
const MEDIA_SHAPES = [[2, 2], [2, 3], [2, 2], [4, 3], [2, 3], [3, 2]];
const GAPS = [1, 0];
const CHIP_IN = 0.8;
const WORD_DELAY = 0.12;
const MEDIA_IN = 0.9;
const EXIT = 0.8;
const EXIT_STAGGER = 0.05;
const EXIT_PAD = 0.1;
const MEDIA_ZOOM = 0.12;
const MEDIA_DRIFT = 0.01;

const phrasesOf = (raw) => String(raw || '').split(/\n|\|/).map((line) => line.trim().split(/\s+/).filter(Boolean)).filter((words) => words.length);

function seeded(seed) {
  let a = Math.floor(seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function gridOf(p, width, height) {
  const cell = Math.min(width, height) / Math.max(3, p.cells);
  const cols = Math.floor(width / cell);
  const rows = Math.floor(height / cell);
  return { cell, cols, rows, ox: (width - cols * cell) / 2, oy: (height - rows * cell) / 2 };
}

function shapesOf(words, size, grid) {
  const room = grid.cols - 2 * EDGE;
  const shapes = [];
  words.forEach((text, k) => {
    if (k > 0) {
      const [c, r] = MEDIA_SHAPES[(k - 1) % MEDIA_SHAPES.length];
      shapes.push({ kind: 'media', text: '', cols: Math.min(c, room), rows: Math.min(r, grid.rows - 2 * EDGE) });
    }
    const span = Math.ceil((text.length * CHAR_EM * size) / grid.cell + 2 * CHIP_PAD);
    shapes.push({ kind: 'word', text, cols: Math.min(Math.max(1, span), room), rows: 1 });
  });
  return shapes;
}

const free = (taken, c, r, s, g) => taken.every((o) => c + s.cols + g <= o.col || o.col + o.cols + g <= c || r + s.rows + g <= o.row || o.row + o.rows + g <= r);

const spread = (taken, c, r, s) => taken.reduce((best, o) => Math.min(best, Math.hypot(c + s.cols / 2 - o.col - o.cols / 2, r + s.rows / 2 - o.row - o.rows / 2)), Infinity);

const smaller = (s) => (s.kind === 'media' && s.cols * s.rows > 1 ? { ...s, cols: Math.max(1, s.cols - (s.cols >= s.rows ? 1 : 0)), rows: Math.max(1, s.rows - (s.rows > s.cols ? 1 : 0)) } : null);

function spot(taken, s, grid, rand, g) {
  let best = null;
  for (let r = EDGE; r <= grid.rows - EDGE - s.rows; r++) {
    for (let c = EDGE; c <= grid.cols - EDGE - s.cols; c++) {
      const luck = JITTER_MIN + JITTER * rand();
      if (!free(taken, c, r, s, g)) {
        continue;
      }
      const score = Math.min(spread(taken, c, r, s), FAR) * luck;
      if (!best || score > best.score) {
        best = { col: c, row: r, score };
      }
    }
  }
  return best;
}

function sizesOf(shape) {
  const sizes = [];
  for (let s = shape; s; s = smaller(s)) {
    sizes.push(s);
  }
  return sizes;
}

function place(shapes, grid, rand) {
  const taken = [];
  for (const shape of shapes) {
    const fit = GAPS.flatMap((g) => sizesOf(shape).map((s) => ({ s, g }))).map(({ s, g }) => ({ s, best: spot(taken, s, grid, rand, g) })).find((f) => f.best);
    if (fit) {
      taken.push({ ...fit.s, col: fit.best.col, row: fit.best.row });
    }
  }
  return taken;
}

function gridLayout(p, width, height) {
  const grid = gridOf(p, width, height);
  const size = p.textSize * grid.cell;
  let counter = 0;
  const items = phrasesOf(p.phrases).flatMap((words, k) => {
    const shapes = shapesOf(words, size, grid).map((s, order) => ({ ...s, order }));
    return place(shapes, grid, seeded(Number(p.seed) + 1 + k * 97)).sort((a, b) => a.order - b.order).map((s) => ({
      kind: s.kind,
      text: s.text,
      phrase: k,
      order: s.order,
      size,
      media: s.kind === 'media' ? counter++ : -1,
      x: grid.ox + s.col * grid.cell,
      y: grid.oy + s.row * grid.cell,
      w: s.cols * grid.cell,
      h: s.rows * grid.cell
    }));
  });
  return { grid, items };
}

function gridFrame(p, t, length, width, height) {
  const { grid, items } = gridLayout(p, width, height);
  const count = Math.max(1, ...items.map((c) => c.phrase + 1));
  const slot = length / count;
  const last = (k) => Math.max(...items.filter((c) => c.phrase === k).map((c) => c.order));
  return {
    cell: grid.cell,
    ox: grid.ox,
    oy: grid.oy,
    items: items.map((c) => {
      const at = c.phrase * slot + p.lead + c.order * p.beat;
      const leave = (c.phrase + 1) * slot - EXIT_PAD - EXIT - (last(c.phrase) - c.order) * EXIT_STAGGER;
      const fade = 1 - smooth(span(t, leave, EXIT));
      if (c.kind === 'media') {
        const open = expoInOut(span(t, at, MEDIA_IN));
        return { ...c, chip: 0, fade, reveal: open, opacity: fade, rise: 0, zoom: 1 + MEDIA_ZOOM * (1 - open) + MEDIA_DRIFT * Math.max(0, t - at) };
      }
      const word = wordIn(t, at + WORD_DELAY);
      return { ...c, chip: expoInOut(span(t, at, CHIP_IN)), fade, ink: word.opacity, reveal: 0, opacity: fade * word.opacity, rise: word.rise, zoom: 1 };
    })
  };
}
`;
