import { SOFT_SETTLE } from '../soft-settle';

export const CC_MODEL = String.raw`
${SOFT_SETTLE}
const MIN_CARDS = 5;
const MAX_CARDS = 10;
const KINDS = ['type', 'photo', 'list', 'photo', 'letter', 'photo', 'colour', 'photo', 'list', 'photo'];
const STEP_X = 0.56;
const STEP_Y = 0.42;
const ENTER_SCALE = 0.9;
const ENTER_TURN = -7;
const LEAVE_SCALE = 1.04;
const MAX_MOVE_SHARE = 0.8;

const cascadeCount = (p) => Math.max(MIN_CARDS, Math.min(MAX_CARDS, Math.round(p.count) || MIN_CARDS));

function cascadeLayout(p) {
  const n = cascadeCount(p);
  let photo = 0;
  const cards = Array.from({ length: n }, (_, k) => {
    const kind = KINDS[k % KINDS.length];
    return { k, kind, media: kind === 'photo' ? photo++ : -1 };
  });
  return { n, cards };
}

function slotOf(k, n, t, length, p) {
  const step = length / n;
  const i = Math.floor(t / step);
  const u = t - i * step;
  const before = wrap(k + i, n);
  const move = Math.min(p.stepSeconds, step * MAX_MOVE_SHARE);
  const lag = Math.min(p.stagger, (step - move) / Math.max(1, n - 1));
  return wrap(before + glide((u - (n - 1 - before) * lag) / move), n);
}

function placeAt(j, n, spread) {
  const middle = (n - 1) / 2;
  const fadeIn = smooth(clamp01(j));
  const fadeOut = smooth(clamp01(n - j));
  const entering = 1 - clamp01(j);
  const leaving = clamp01(j - (n - 1));
  return {
    x: (j - middle) * STEP_X * spread,
    y: (j - middle) * STEP_Y * spread,
    scale: lerp(1, ENTER_SCALE, entering) * lerp(1, LEAVE_SCALE, leaving),
    turn: ENTER_TURN * entering,
    opacity: fadeIn * fadeOut,
    z: Math.round(j * 100)
  };
}

function cascadeFrame(layout, p, t, length) {
  const cards = layout.cards.map((card) => placeAt(slotOf(card.k, layout.n, t, length, p), layout.n, p.spread));
  return { cards, scroll: wrap(t / length, 1) };
}
`;
