import { SOFT_SETTLE } from '../soft-settle';

export const PD_MODEL = String.raw`
${SOFT_SETTLE}
const MIN_CARDS = 6;
const MAX_CARDS = 16;
const KINDS = ['photo', 'paper', 'photo', 'accent', 'photo', 'dark'];
const BASE_SECONDS = 12;
const BEATS = { open: 0.3, firstRiffle: 2.1, firstTurn: 5.0, secondRiffle: 7.0, secondTurn: 9.0, close: 10.6 };
const OPEN_SECONDS = 1.4;
const TURN_SECONDS = 1.5;
const CLOSE_SECONDS = 1.25;
const FLICK_SECONDS = 0.9;
const RIFFLE_WINDOW = 2.6;
const FAN_STEP = 3.4;
const FAN_SHIFT = 0.012;
const THICKNESS = 0.012;
const RIFFLE_TURN = 34;
const RIFFLE_LIFT = 0.06;
const DECK_TURN = { x: 30, y: -24, z: -16 };
const DRIFT_TURN = 3;
const DRIFT_SHIFT = 0.012;

const deckCount = (p) => Math.max(MIN_CARDS, Math.min(MAX_CARDS, Math.round(p.count) || MIN_CARDS));

function fanLayout(p) {
  const n = deckCount(p);
  let photo = 0;
  const cards = Array.from({ length: n }, (_, k) => {
    const kind = k === 0 ? 'front' : KINDS[(k - 1) % KINDS.length];
    return { k, kind, media: kind === 'photo' ? photo++ : -1 };
  });
  return { n, cards };
}

const swell = (x) => (x <= 0 || x >= 1 ? 0 : x < 0.5 ? smooth(2 * x) : smooth(2 - 2 * x));

function fanTiming(p, n, length) {
  const k = length / BASE_SECONDS;
  const flick = FLICK_SECONDS * k;
  const gap = Math.min(p.riffleGap, (RIFFLE_WINDOW * k - flick) / Math.max(1, n - 2));
  const at = Object.fromEntries(Object.entries(BEATS).map(([name, s]) => [name, s * k]));
  return { k, flick, gap, at };
}

function riffleOf(card, n, timing, t) {
  if (card.k === 0) {
    return 0;
  }
  const { flick, gap, at } = timing;
  const backFirst = at.firstRiffle + (n - 1 - card.k) * gap;
  const frontFirst = at.secondRiffle + (card.k - 1) * gap;
  return Math.max(swell(span(t, backFirst, flick)), swell(span(t, frontFirst, flick)));
}

function fanFrame(layout, p, t, length) {
  const timing = fanTiming(p, layout.n, length);
  const { k, at } = timing;
  const open = glide(span(t, at.open, OPEN_SECONDS * k)) * (1 - glide(span(t, at.close, CLOSE_SECONDS * k)));
  const turn = 180 * (glide(span(t, at.firstTurn, TURN_SECONDS * k)) - glide(span(t, at.secondTurn, TURN_SECONDS * k)));
  const cards = layout.cards.map((card) => {
    const riffle = riffleOf(card, layout.n, timing, t);
    return {
      depth: -card.k * THICKNESS,
      shift: card.k * FAN_SHIFT * open * p.fan,
      fan: -card.k * FAN_STEP * open * p.fan,
      riffle: -RIFFLE_TURN * riffle,
      lift: RIFFLE_LIFT * riffle,
      turn: card.k === 0 ? turn : 0
    };
  });
  const drift = loopWave(t, length, 1);
  return {
    cards,
    deck: { x: DECK_TURN.x + DRIFT_TURN * loopWave(t, length, 1, 1.1), y: DECK_TURN.y + DRIFT_TURN * drift, z: DECK_TURN.z, shiftX: DRIFT_SHIFT * drift, shiftY: DRIFT_SHIFT * loopWave(t, length, 2) * 0.5 }
  };
}
`;
