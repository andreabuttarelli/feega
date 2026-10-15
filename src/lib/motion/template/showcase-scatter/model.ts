import { SOFT_SETTLE } from '../soft-settle';

export const SS_MODEL = String.raw`
${SOFT_SETTLE}
const MIN_CARDS = 6;
const MAX_CARDS = 12;
const SLOTS = [
  { x: 0.5, y: 0.5, s: 0.2, a: 0.78, kind: 'photo', z: 1, hero: true },
  { x: 0.08, y: 0.035, s: 0.24, a: 1.3, kind: 'block', z: 0.4 },
  { x: 0.4, y: 0.11, s: 0.21, a: 1, kind: 'dots', z: 0.7 },
  { x: 0.9, y: 0.26, s: 0.28, a: 1.05, kind: 'photo', z: 0.55 },
  { x: 0.14, y: 0.36, s: 0.21, a: 1, kind: 'type', z: 0.8 },
  { x: 0.08, y: 0.72, s: 0.24, a: 0.82, kind: 'photo', z: 0.45 },
  { x: 0.79, y: 0.73, s: 0.2, a: 1, kind: 'round', z: 0.9 },
  { x: 0.5, y: 0.91, s: 0.2, a: 1, kind: 'photo', z: 0.6 },
  { x: 0.93, y: 0.94, s: 0.22, a: 1, kind: 'photo', z: 0.35 },
  { x: 0.7, y: 0.36, s: 0.12, a: 1, kind: 'dots', z: 0.25 },
  { x: 0.27, y: 0.6, s: 0.13, a: 0.8, kind: 'photo', z: 0.3 },
  { x: 0.64, y: 0.63, s: 0.11, a: 1, kind: 'block', z: 0.2 }
];
const ENTRANCE_ORDER = [4, 2, 0, 6, 1, 5, 3, 7, 9, 11, 8, 10];
const ENTER_AT = 0.3;
const ENTER_GAP = 0.14;
const ENTER_SECONDS = 1.3;
const EXIT_SECONDS = 1.1;
const EXIT_GAP = 0.05;
const EXIT_END = 0.05;
const ENTER_SCALE = 0.84;
const RISE = 0.06;
const ORBIT = 0.022;
const ORBIT_Y = 0.7;
const DEPTH_SCALE = 0.25;
const HERO_REACH = 0.24;
const HERO_MOVES = [0.24, 0.58];
const HERO_SECONDS = 1.7;
const TITLE_AT = 0.7;
const TITLE_OUT = 1.3;
const META_AT = 0.2;
const META_SECONDS = 0.9;

const cardCount = (p) => Math.max(MIN_CARDS, Math.min(MAX_CARDS, Math.round(p.count) || MIN_CARDS));

function scatterLayout(p) {
  const n = cardCount(p);
  const order = ENTRANCE_ORDER.filter((k) => k < n);
  let photo = 0;
  const cards = SLOTS.slice(0, n).map((slot, k) => {
    const media = slot.kind === 'photo' || slot.kind === 'round' ? photo++ : -1;
    return { ...slot, k, media, order: order.indexOf(k), phase: (k * 2.39996) % TURN };
  });
  return { cards, n };
}

function presence(card, n, t, length) {
  const inAt = ENTER_AT + card.order * ENTER_GAP;
  const outAt = length - EXIT_END - EXIT_SECONDS - (n - 1 - card.order) * EXIT_GAP;
  const enter = glide(span(t, inAt, ENTER_SECONDS));
  const leave = glide(span(t, outAt, EXIT_SECONDS));
  return enter * (1 - leave);
}

function heroX(t, length) {
  const steps = HERO_MOVES.map((at) => glide(span(t, at * length, HERO_SECONDS)));
  const home = smooth(span(t, length - EXIT_END, EXIT_END));
  return -HERO_REACH + HERO_REACH * (steps[0] + steps[1]) - 2 * HERO_REACH * home;
}

function scatterFrame(layout, p, t, length) {
  const laps = Math.max(1, Math.round(p.laps) || 1);
  const cards = layout.cards.map((card) => {
    const shown = presence(card, layout.n, t, length);
    const angle = (TURN * laps * t) / length + card.phase;
    const r = ORBIT * p.drift * (0.4 + card.z);
    return {
      x: card.x + (card.hero ? heroX(t, length) : 0),
      y: card.y,
      dx: r * (Math.cos(angle) - Math.cos(card.phase)),
      dy: r * ORBIT_Y * (Math.sin(angle) - Math.sin(card.phase)) + RISE * (1 - shown),
      scale: (1 + DEPTH_SCALE * (card.z - 0.5) * p.depth) * lerp(ENTER_SCALE, 1, shown),
      opacity: clamp01(shown)
    };
  });
  const titleOut = glide(span(t, length - TITLE_OUT - EXIT_END, TITLE_OUT));
  const words = String(p.headline || '').trim().split(/\s+/).filter(Boolean).map((_, i) => {
    const e = wordIn(t, TITLE_AT + i * WORD_GAP);
    return { y: e.rise + WORD_RISE * titleOut, opacity: e.opacity * (1 - titleOut) };
  });
  const meta = glide(span(t, META_AT, META_SECONDS)) * (1 - titleOut);
  return { cards, words, meta };
}
`;
