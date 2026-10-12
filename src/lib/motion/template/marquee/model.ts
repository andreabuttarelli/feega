export const MARQUEE_MODEL = String.raw`
const LOGO_ASPECT = 3.6;
const IMAGE_ASPECT = 1.4;
const QUOTE_ASPECT = 0.4;
const PHASE = 0.37;
const FLING_WINDOW = 0.1;
const MAX_STEP = 0.05;

const KIND = { logos: 'logos', images: 'images', quotes: 'quotes' };
const CONTENT_ROWS = { 'logos + quotes': [KIND.logos, KIND.quotes], logos: [KIND.logos], images: [KIND.images], quotes: [KIND.quotes], 'images + quotes': [KIND.images, KIND.quotes] };
const HEADING = { left: -1, up: -1, right: 1, down: 1 };
const VERTICAL = { up: true, down: true };

const rowCount = (p) => Math.max(1, Math.min(4, Math.round(p.rows)));
const kindOf = (p, row) => {
  const kinds = CONTENT_ROWS[p.content] ?? CONTENT_ROWS.logos;
  return kinds[row % kinds.length];
};
const isVertical = (p) => Boolean(VERTICAL[p.direction]);
const headingOf = (p, row) => (HEADING[p.direction] ?? -1) * (p.alternate && row % 2 ? -1 : 1);

function cellOf(p, kind) {
  const size = Math.max(0.02, p.itemSize);
  const cells = {
    [KIND.logos]: { w: size * LOGO_ASPECT, h: size },
    [KIND.images]: { w: size * 2 * IMAGE_ASPECT, h: size * 2 },
    [KIND.quotes]: { w: p.quoteWidth, h: p.quoteWidth * QUOTE_ASPECT }
  };
  return cells[kind] ?? cells[KIND.logos];
}

function rowPlan(p, row, count, length) {
  const kind = kindOf(p, row);
  const cell = cellOf(p, kind);
  const main = isVertical(p) ? cell.h : cell.w;
  const pitch = main + Math.max(0, p.gap);
  const span = Math.max(1, count) * pitch;
  const wraps = Math.max(1, Math.round((Math.max(0, p.speed) * length) / span));
  const cruise = (headingOf(p, row) * wraps * span) / length;
  return { kind, cell, main, pitch, span, wraps, cruise, phase: row * PHASE * span };
}

const wrapped = (pos, span) => pos - span * Math.floor(pos / span);

const cruiseAt = (plan, t) => wrapped(plan.phase + plan.cruise * t, plan.span);

const copiesFor = (plan, view) => Math.ceil(view / plan.span) + 2;

function glide(state, target, dt, tau) {
  const k = Math.exp(-dt / Math.max(1e-3, tau));
  const v = target + (state.vel - target) * k;
  const pos = state.pos + target * dt + (state.vel - target) * Math.max(1e-3, tau) * (1 - k);
  return { pos, vel: v };
}

function glideSteps(state, target, dt, tau) {
  let s = state;
  let left = dt;
  while (left > 1e-9) {
    const step = Math.min(MAX_STEP, left);
    s = glide(s, target, step, tau);
    left -= step;
  }
  return s;
}

function flingOf(samples) {
  const last = samples[samples.length - 1];
  const first = samples.find((s) => last.t - s.t <= FLING_WINDOW) ?? last;
  return last.t > first.t ? (last.at - first.at) / (last.t - first.t) : 0;
}

const dragTo = (grab, at) => grab.pos + (at - grab.at);
`;
