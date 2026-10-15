import { SOFT_SETTLE } from '../soft-settle';

export const PS_MODEL = String.raw`
${SOFT_SETTLE}
const MIN_CARDS = 3;
const MAX_CARDS = 7;
const KINDS = ['photo', 'colourA', 'colourB', 'colourC'];
const RISE = 0.075;
const SHRINK = 0.05;
const FLIP_TURN = -78;
const FLIP_DROP = 0.32;
const ARRIVE_LIFT = 0.12;
const LIFT_Y = -0.025;
const LIFT_SCALE = 0.035;
const LIFT_TURN = 6;
const MAX_FLIP_SHARE = 0.7;
const SLOT_LAG = 0.05;
const FLOOR_SWAY = 0.012;

const deckCount = (p) => Math.max(MIN_CARDS, Math.min(MAX_CARDS, Math.round(p.count) || MIN_CARDS));

function deckLayout(p) {
  const n = deckCount(p);
  let photo = 0;
  const cards = Array.from({ length: n }, (_, k) => {
    const kind = KINDS[k % KINDS.length];
    return { k, kind, media: kind === 'photo' ? photo++ : -1 };
  });
  return { n, cards };
}

function deckSlot(k, n, t, length, p) {
  const step = length / n;
  const i = Math.floor(t / step);
  const u = t - i * step;
  const before = wrap(k - i, n);
  const flip = Math.min(p.flip, step * MAX_FLIP_SHARE);
  const hold = step - flip;
  return wrap(before - glide((u - hold - before * SLOT_LAG) / (flip - (n - 1) * SLOT_LAG)), n);
}

function slotPose(j, n, p) {
  const away = j > n - 1 ? n - j : 0;
  const falling = away > 0 && away < 0.5 ? away / 0.5 : 0;
  const arriving = away >= 0.5 ? (away - 0.5) / 0.5 : 1;
  const rest = away > 0 ? (falling > 0 ? 0 : n - 1) : j;
  const lift = smooth(clamp01(1 - rest)) * (away > 0 ? 1 - smooth(falling) : 1);
  return {
    y: -rest * RISE + falling * falling * FLIP_DROP - (away >= 0.5 ? (1 - arriving) * ARRIVE_LIFT : 0) + lift * LIFT_Y,
    scale: (1 - rest * SHRINK) * (1 + lift * LIFT_SCALE),
    turn: p.tilt - lift * LIFT_TURN + FLIP_TURN * smooth(falling),
    opacity: away >= 0.5 ? smooth(arriving) : 1 - smooth(clamp01((falling - 0.4) / 0.6)),
    z: away >= 0.5 ? 0 : Math.round((n - rest) * 100) + (falling > 0 ? 100 * n : 0),
    lift
  };
}

function stackFrame(layout, p, t, length) {
  const cards = layout.cards.map((card) => slotPose(deckSlot(card.k, layout.n, t, length, p), layout.n, p));
  const blobs = [0, 1, 2].map((b) => ({
    x: 0.22 * loopWave(t, length, 1 + b, b * 2.1),
    y: 0.16 * loopWave(t, length, 2 - (b % 2), b * 1.3 + 0.7),
    turn: 40 * loopWave(t, length, 1, b)
  }));
  return { cards, blobs, sway: FLOOR_SWAY * loopWave(t, length, 1, 0.5) };
}
`;
