export const STORY_MODEL = String.raw`
const CHAPTERS = 3;
const MASK_TRAVEL = 1.1;
const LABEL_SLOTS = 1;
const LINE_HEIGHT = 0.98;
const CHAR_WIDTH = 0.5;
const WIDE = 1.4;
const IDLE = 0.01;
const MARK_DIM = 0.35;
const MARGIN = 0.04;
const EXIT = 1.02;
const SWAP_LEAD = 0.35;

const SWAP_STYLE = {
  'mask-up': { travel: MASK_TRAVEL, dir: -1, fade: false },
  'mask-down': { travel: MASK_TRAVEL, dir: 1, fade: false },
  fade: { travel: 0.12, dir: -1, fade: true }
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const span = (t, at, length) => clamp01((t - at) / Math.max(length, 1e-6));
const expoInOut = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2);
const powInOut = (n) => (x) => (x < 0.5 ? Math.pow(2 * x, n) / 2 : 1 - Math.pow(2 - 2 * x, n) / 2);
const EASE = { expo: expoInOut, quint: powInOut(5), cubic: powInOut(3) };
const smooth = (x) => x * x * x * (x * (x * 6 - 15) + 10);

const linesOf = (text) => String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);

function storyChapters(p) {
  return Array.from({ length: CHAPTERS }, (_, i) => ({
    lines: linesOf(p['headline' + (i + 1)]),
    kicker: String(p['kicker' + (i + 1)] || ''),
    image: String(p['image' + (i + 1)] || ''),
    lane: Number(p['lane' + (i + 1)]) || 0,
    speed: Number(p['speed' + (i + 1)]) || 1
  }));
}

function storyPhases(p, length) {
  const unit = length / (CHAPTERS * p.holdSeconds + (CHAPTERS - 1) * p.moveSeconds);
  const hold = p.holdSeconds * unit;
  const move = p.moveSeconds * unit;
  const holds = Array.from({ length: CHAPTERS }, (_, k) => [k * (hold + move), k * (hold + move) + hold]);
  return { holds, moves: holds.slice(0, -1).map(([, end]) => [end, end + move]) };
}

function storyPosition(p, t, length) {
  const ease = EASE[p.easing] || expoInOut;
  const { moves } = storyPhases(p, length);
  const k = moves.findIndex(([a, b]) => t > a && t < b);
  if (k < 0) {
    return moves.filter(([, b]) => t >= b).length;
  }
  return k + ease(span(t, moves[k][0], moves[k][1] - moves[k][0]));
}

function swapPlan(p, length) {
  const chapters = storyChapters(p);
  const { moves } = storyPhases(p, length);
  return moves.map(([a, b], k) => {
    const slots = LABEL_SLOTS + Math.max(chapters[k].lines.length, chapters[k + 1].lines.length);
    const lead = p.swapDuration * SWAP_LEAD;
    const total = (slots - 1) * p.swapStagger + lead + p.swapDuration;
    const start = Math.max(a, (a + b) / 2 - total / 2);
    const outAt = Array.from({ length: slots }, (_, j) => start + j * p.swapStagger);
    return { outAt, inAt: outAt.map((at) => at + lead) };
  });
}

function slotFrame(p, t, inAt, outAt) {
  const style = SWAP_STYLE[p.swapStyle] || SWAP_STYLE['mask-up'];
  const inRaw = inAt === null ? 1 : span(t, inAt, p.swapDuration);
  const outRaw = outAt === null ? 0 : span(t, outAt, p.swapDuration);
  const enter = inAt === null ? 1 : expoInOut(inRaw);
  const leave = expoInOut(outRaw);
  const y = -style.dir * style.travel * (1 - enter) + style.dir * style.travel * leave;
  const opacity = style.fade ? smooth(inRaw) * (1 - smooth(outRaw)) : 1;
  const on = inRaw > 0 && outRaw < 1 && (!style.fade || opacity > 0);
  return { y, opacity, on };
}

function headFrames(p, t, length) {
  const chapters = storyChapters(p);
  const plan = swapPlan(p, length);
  return chapters.map((chapter, i) => {
    const inAt = (j) => (i === 0 ? null : plan[i - 1].inAt[j]);
    const outAt = (j) => (i === chapters.length - 1 ? null : plan[i].outAt[j]);
    const slot = (j) => slotFrame(p, t, inAt(j), outAt(j));
    const label = slotFrame(p, t, i === 0 ? null : plan[i - 1].outAt[0], outAt(0));
    return { kicker: label, index: label, lines: chapter.lines.map((_, j) => slot(j + LABEL_SLOTS)) };
  });
}

function storyGrid(p, width, height) {
  const margin = MARGIN * Math.min(width, height);
  const columns = Math.max(1, Math.round(p.columns));
  const rows = Math.max(3, Math.round(p.rows));
  const col = (width - 2 * margin) / columns;
  const row = (height - 2 * margin) / rows;
  return {
    margin,
    col,
    row,
    xs: Array.from({ length: columns + 1 }, (_, k) => margin + k * col),
    ys: Array.from({ length: rows + 1 }, (_, k) => margin + k * row)
  };
}

function headBox(p, width, height) {
  const size = (p.fontSize / 100) * Math.min(width, height);
  const chapters = storyChapters(p);
  const lines = Math.max(1, ...chapters.map((c) => c.lines.length));
  const chars = Math.max(1, ...chapters.flatMap((c) => c.lines.map((l) => l.length)));
  const w = Math.min(width, chars * CHAR_WIDTH * size);
  const h = lines * LINE_HEIGHT * size;
  return { x: (width - w) / 2, y: (height - h) / 2, w, h };
}

function wideRest(p, chapter, grid, head, gap, i, short) {
  const top = grid.ys[1];
  const bottom = grid.ys[grid.ys.length - 2];
  const left = grid.xs[0];
  const right = grid.xs[grid.xs.length - 1];
  const w = Math.min(p.imageSize * short, (bottom - top) / p.imageRatio, (right - left) / 2);
  const h = w * p.imageRatio;
  const lane = grid.xs[Math.min(grid.xs.length - 1, Math.max(0, Math.round(chapter.lane)))];
  const x = Math.min(lane, right - w);
  const clear = x + w <= head.x - gap || x >= head.x + head.w + gap;
  const leftSide = x + w / 2 < head.x + head.w / 2;
  const safeX = clear ? x : leftSide ? Math.max(left, head.x - gap - w) : Math.min(right - w, head.x + head.w + gap);
  return { x: safeX, y: (top + bottom) / 2 - h / 2, w, h };
}

function stackedRest(p, chapter, grid, head, gap, i, short) {
  const top = grid.ys[1];
  const bottom = grid.ys[grid.ys.length - 2];
  const left = grid.xs[0];
  const right = grid.xs[grid.xs.length - 1];
  const room = Math.max(0, Math.min(head.y - gap - top, bottom - (head.y + head.h + gap)));
  const w = Math.min(p.imageSize * short, room / p.imageRatio, right - left);
  const h = w * p.imageRatio;
  const lane = grid.xs[Math.min(grid.xs.length - 1, Math.max(0, Math.round(chapter.lane)))];
  const x = Math.max(left, Math.min(lane, right - w));
  const above = i % 2 === 0;
  const y = above ? top + (head.y - gap - top - h) / 2 : head.y + head.h + gap + (bottom - head.y - head.h - gap - h) / 2;
  return { x, y, w, h };
}

const REST = { wide: wideRest, stacked: stackedRest };

function imageFrames(p, t, length, position, width, height) {
  const grid = storyGrid(p, width, height);
  const head = headBox(p, width, height);
  const gap = grid.col * 0.5;
  const rest = REST[width / height >= WIDE ? 'wide' : 'stacked'];
  return storyChapters(p).map((chapter, i) => {
    const r = rest(p, chapter, grid, head, gap, i, Math.min(width, height));
    const away = (i - position) * Math.max(1, chapter.speed);
    const idle = p.idleDrift * IDLE * height * Math.sin((2 * Math.PI * t) / Math.max(length, 1e-6) + i);
    const travel = EXIT * (away < 0 ? r.y + r.h - grid.ys[1] : grid.ys[grid.ys.length - 2] - r.y);
    return { x: r.x, y: r.y + away * travel + idle, w: r.w, h: r.h, shift: away * p.parallax };
  });
}

function markFrames(position) {
  return Array.from({ length: CHAPTERS }, (_, k) => MARK_DIM + (1 - MARK_DIM) * smooth(clamp01(1 - Math.abs(position - k))));
}

function storyFrame(p, t, length, width, height) {
  const position = storyPosition(p, t, length);
  return {
    chapter: Math.min(CHAPTERS - 1, Math.max(0, Math.round(position))),
    position,
    heads: headFrames(p, t, length),
    images: imageFrames(p, t, length, position, width, height),
    marks: markFrames(position)
  };
}
`;
