import { WORD_ENTRANCE } from '../word-entrance';

export const COMMENTS_MODEL = String.raw`
${WORD_ENTRANCE}
const FIELD_SEPARATOR = '|';
const MAX_RATING = 5;
const GOLDEN = 0.6180339887;
const EXIT = 1.1;
const EXIT_SPREAD = 0.6;
const VEIL_IN = 1.2;
const DIRECTION = { up: () => -1, down: () => 1, alternate: (col) => (col % 2 ? 1 : -1) };

function parseComment(line) {
  const parts = line.split(FIELD_SEPARATOR).map((s) => s.trim());
  if (parts.length < 3) {
    return { name: '', handle: '', text: parts.join(' ' + FIELD_SEPARATOR + ' '), rating: 0, time: '' };
  }
  const rating = Math.round(Number(parts[3]) || 0);
  return { name: parts[0], handle: parts[1], text: parts[2], rating: Math.max(0, Math.min(MAX_RATING, rating)), time: parts[4] || '' };
}

function parseComments(raw) {
  return String(raw || '').split('\n').map((l) => l.trim()).filter(Boolean).map(parseComment);
}

function gridColumns(p, size) {
  const unit = Math.min(size.width, size.height);
  const cardWidth = p.cardWidth * unit;
  const gap = p.gap * unit;
  return { count: Math.max(1, Math.ceil((size.width + cardWidth) / (cardWidth + gap))), cardWidth, gap };
}

function columnCycles(comments, columns) {
  const n = Math.max(1, comments);
  const length = Math.min(n, Math.max(1, Math.ceil(n / columns)));
  return Array.from({ length: columns }, (_, c) => Array.from({ length }, (_, k) => (c * length + k) % n));
}

function gridLayout(p, size, heights) {
  const { count, cardWidth, gap } = gridColumns(p, size);
  const margin = Math.max(...heights, 1) + gap;
  const left = (size.width - (count * cardWidth + (count - 1) * gap)) / 2;
  const n = heights.length;
  const reach = size.height + margin;
  const longEnough = (cycle) => {
    let total = cycle.reduce((sum, i) => sum + heights[i] + gap, 0);
    while (total < reach && cycle.length < n) {
      const next = (cycle[cycle.length - 1] + 1) % n;
      cycle.push(next);
      total += heights[next] + gap;
    }
    return cycle;
  };
  const columns = columnCycles(n, count).map(longEnough).map((cycle, col) => {
    const tops = [];
    const period = cycle.reduce((at, index) => {
      tops.push(at);
      return at + heights[index] + gap;
    }, 0);
    const copies = Math.max(1, Math.ceil((size.height + 2 * margin) / period));
    const loops = p.speed > 0 ? Math.max(1, Math.round((p.speed * size.height) / period)) : 0;
    const sign = (DIRECTION[p.direction] || DIRECTION.up)(col);
    return { x: left + col * (cardWidth + gap), cycle, tops, period, copies, phase: ((col * GOLDEN) % 1) * period, travel: sign * loops * period };
  });
  return { cardWidth, gap, margin, heights, columns };
}

const wrap = (v, span, margin) => ((((v + margin) % span) + span) % span) - margin;

function cardEntrance(p, t, length, reach) {
  const at = p.enterAt + p.stagger * reach;
  const out = p.leave ? expoInOut(span(t, length - EXIT - EXIT_SPREAD * (1 - reach), EXIT)) : 0;
  return {
    opacity: smooth(span(t, at, p.enterSeconds * 0.6)) * (1 - smooth(out)),
    rise: 1 - expoInOut(span(t, at, p.enterSeconds))
  };
}

const titleWords = (title) => String(title || '').trim().split(/\s+/).filter(Boolean);

function titleOut(p, t, length, i) {
  return p.leave ? expoInOut(span(t, length - EXIT - 0.2 + i * 0.04, EXIT * 0.8)) : 0;
}

function gridFrame(layout, p, t, length, size) {
  const cx = size.width / 2;
  const cy = size.height / 2;
  const radius = Math.hypot(cx, cy);
  const cards = layout.columns.flatMap((column, col) => {
    const extent = column.copies * column.period;
    const yAt = (base, time) => wrap(base + column.phase + (column.travel * time) / length, extent, layout.margin);
    return Array.from({ length: column.copies }, (_, copy) =>
      column.cycle.map((index, k) => {
        const base = copy * column.period + column.tops[k];
        const h = layout.heights[index];
        const start = yAt(base, p.enterAt);
        const reach = Math.min(1, Math.hypot(column.x + layout.cardWidth / 2 - cx, start + h / 2 - cy) / radius);
        return { col, copy, index, x: column.x, y: yAt(base, t), h, ...cardEntrance(p, t, length, reach) };
      })
    ).flat();
  });
  const words = titleWords(p.title).map((_, i) => {
    const e = wordIn(t, p.titleAt + i * WORD_GAP);
    const out = titleOut(p, t, length, i);
    return { y: e.rise - 0.1 * out, opacity: e.opacity * (1 - smooth(out)) };
  });
  const dim = smooth(span(t, p.titleAt, VEIL_IN)) * (1 - smooth(titleOut(p, t, length, 0)));
  return { cards, words, veil: p.gridDim * dim, blur: p.gridBlur * dim };
}
`;
