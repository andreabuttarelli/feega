export const STORY_MODEL = String.raw`
const CHAPTERS = 3;
const SETTLE = 0.012;
const MASK_TRAVEL = 1.1;
const GRID_IN = 1.2;
const GRID_GAP = 0.025;
const LABEL_SLOTS = 1;

const SWAP_STYLE = {
  'mask-up': { travel: MASK_TRAVEL, dir: -1, fade: false },
  'mask-down': { travel: MASK_TRAVEL, dir: 1, fade: false },
  fade: { travel: 0.12, dir: -1, fade: true }
};

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const span = (t, at, length) => clamp01((t - at) / Math.max(length, 1e-6));
const expoInOut = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2);
const settle = (x) => expoInOut(x) + SETTLE * Math.sin(Math.PI * clamp01((x - 0.5) / 0.5));
const smooth = (x) => x * x * x * (x * (x * 6 - 15) + 10);

const linesOf = (text) => String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);

const chapterAt = (progress, count) => Math.min(count - 1, Math.max(0, Math.floor(clamp01(progress) * count)));

function storyChapters(p) {
  return Array.from({ length: CHAPTERS }, (_, i) => ({
    lines: linesOf(p['headline' + (i + 1)]),
    kicker: String(p['kicker' + (i + 1)] || ''),
    image: String(p['image' + (i + 1)] || ''),
    lane: Number(p['lane' + (i + 1)]) || 0,
    speed: Number(p['speed' + (i + 1)]) || 1
  }));
}

function slotsOf(chapter) {
  return LABEL_SLOTS + chapter.lines.length;
}

function swapPlan(p, length) {
  const chapters = storyChapters(p);
  return chapters.slice(1).map((next, b) => {
    const slots = Math.max(slotsOf(chapters[b]), slotsOf(next));
    const lead = p.swapDuration * p.swapOverlap;
    const total = (slots - 1) * p.swapStagger + lead + p.swapDuration;
    const start = ((b + 1) * length) / CHAPTERS - total / 2;
    const outAt = Array.from({ length: slots }, (_, j) => start + j * p.swapStagger);
    return { outAt, inAt: outAt.map((at) => at + lead) };
  });
}

function slotFrame(p, t, inAt, outAt) {
  const style = SWAP_STYLE[p.swapStyle] || SWAP_STYLE['mask-up'];
  const inRaw = inAt === null ? 1 : span(t, inAt, p.swapDuration);
  const outRaw = outAt === null ? 0 : span(t, outAt, p.swapDuration);
  const enter = inAt === null ? 1 : settle(inRaw);
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
    const inAt = (j) => (i === 0 ? p.introAt + j * p.swapStagger : plan[i - 1].inAt[j]);
    const outAt = (j) => (i === chapters.length - 1 ? null : plan[i].outAt[j]);
    const slot = (j) => slotFrame(p, t, inAt(j), outAt(j));
    return { kicker: slot(0), index: slot(0), lines: chapter.lines.map((_, j) => slot(j + LABEL_SLOTS)) };
  });
}

function storyGrid(p, width, height) {
  const margin = p.margin * Math.min(width, height);
  const columns = Math.max(1, Math.round(p.columns));
  const rows = Math.max(1, Math.round(p.rows));
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

function imageFrames(p, progress, width, height) {
  const grid = storyGrid(p, width, height);
  const right = grid.xs[grid.xs.length - 1];
  const w = Math.min(p.imageSize * Math.min(width, height), right - grid.margin);
  const h = w * p.imageRatio;
  return storyChapters(p).map((chapter, i) => {
    const centre = (i + 0.5) / CHAPTERS;
    const lane = Math.min(grid.xs.length - 1, Math.max(0, Math.round(chapter.lane)));
    const x = Math.min(grid.xs[lane], right - w);
    const away = (centre - progress) * CHAPTERS * chapter.speed;
    return { x, y: height / 2 - h / 2 + away * height, w, h, shift: away * p.parallax };
  });
}

function gridFrames(grid, t) {
  const draw = (k) => smooth(span(t, k * GRID_GAP, GRID_IN));
  return { v: grid.xs.map((_, k) => draw(k)), h: grid.ys.map((_, k) => draw(k)) };
}

function markFrames(progress) {
  const edge = 0.04;
  return Array.from({ length: CHAPTERS }, (_, i) => {
    const from = i / CHAPTERS;
    const to = (i + 1) / CHAPTERS;
    const rise = i === 0 ? 1 : smooth(span(progress, from - edge, 2 * edge));
    const fall = i === CHAPTERS - 1 ? 0 : smooth(span(progress, to - edge, 2 * edge));
    return 0.35 + 0.65 * rise * (1 - fall);
  });
}

function storyFrame(p, t, length, width, height) {
  const progress = clamp01(t / Math.max(length, 1e-6));
  return {
    chapter: chapterAt(progress, CHAPTERS),
    progress,
    heads: headFrames(p, t, length),
    images: imageFrames(p, progress, width, height),
    marks: markFrames(progress),
    grid: gridFrames(storyGrid(p, width, height), t)
  };
}
`;
