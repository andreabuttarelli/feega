import { SOFT_SETTLE } from '../soft-settle';

export const FR_MODEL = String.raw`
${SOFT_SETTLE}
const MIN_SLIDES = 2;
const MAX_SLIDES = 6;
const HIDDEN_EPSILON = 1e-3;
const MAX_CHANGE_SHARE = 0.6;
const FRONT_LAG = 0.16;
const ENTER_TRAVEL = 0.3;
const LEAVE_SHIFT = 0.2;
const FRONT_PUSH_SHARE = 0.6;
const SCALE_FROM = 0.74;
const DRIFT = 0.012;
const BACK_DRIFT = -0.45;
const AXES = { wipe: [0, 1], slide: [1, 0], scale: [0, 0] };

const slideCount = (p) => Math.max(MIN_SLIDES, Math.min(MAX_SLIDES, Math.round(p.count) || MIN_SLIDES));

function revealTiming(p, length) {
  const n = slideCount(p);
  const slot = length / n;
  return { n, slot, change: Math.min(Math.max(p.change, 0.1), slot * MAX_CHANGE_SHARE) };
}

function layerOf(k, timing, p, t, length, lag, push) {
  const { slot, change } = timing;
  const age = wrap(t - (k * slot - change), length);
  const run = change * (1 - lag);
  const enter = glide(clamp01((age - change * lag) / run));
  const leave = glide(clamp01((age - slot - change * lag) / run));
  const [ax, ay] = AXES[p.reveal] || AXES.wipe;
  const travel = ENTER_TRAVEL * p.parallax;
  const scaled = p.reveal === 'scale';
  const life = clamp01(age / (slot + change));
  return {
    age,
    shown: age < slot + change - HIDDEN_EPSILON,
    cx: (1 - enter) * ax,
    cy: (1 - enter) * ay,
    ix: -(1 - enter) * ax * (1 - travel) - leave * ax * LEAVE_SHIFT * p.parallax,
    iy: -(1 - enter) * ay * (1 - travel) - leave * ay * LEAVE_SHIFT * p.parallax,
    opacity: scaled ? clamp01(enter) : 1,
    grow: scaled ? lerp(SCALE_FROM, 1, enter) : 1,
    scale: 1 + Math.abs(push) * (push >= 0 ? life : 1 - life)
  };
}

const ranked = (layers) => {
  const order = layers.map((l, k) => [l.age, k]).sort((a, b) => b[0] - a[0]).map(([, k]) => k);
  return layers.map((l, k) => ({ ...l, z: order.indexOf(k) + 1 }));
};

function revealFrame(p, t, length) {
  const timing = revealTiming(p, length);
  const ks = Array.from({ length: timing.n }, (_, k) => k);
  const back = ranked(ks.map((k) => layerOf(k, timing, p, t, length, 0, p.push)));
  const front = ranked(ks.map((k) => layerOf(k, timing, p, t, length, FRONT_LAG, -p.push * FRONT_PUSH_SHARE)));
  const revealed = ks.filter((k) => back[k].age >= timing.change);
  const current = revealed.reduce((best, k) => (back[k].age < back[best].age ? k : best), revealed[0] ?? 0);
  const fx = DRIFT * p.parallax * loopWave(t, length, 1);
  const fy = DRIFT * p.parallax * loopWave(t, length, 2) * 0.5;
  return { back, front, current, n: timing.n, frameX: fx, frameY: fy, backX: fx * BACK_DRIFT, backY: fy * BACK_DRIFT };
}
`;
