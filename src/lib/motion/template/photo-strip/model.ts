export const STRIP_MODEL = String.raw`
const SHARPNESS = 5;
const FRONT_LOAD = 1.5;
const SETTLE = 0.015;
const SETTLE_FROM = 0.7;
const MAX_PHOTOS = 12;
const WRAP_MARGIN = 2;
const CAPTION_OUT = 0.15;
const CAPTION_IN = 0.8;
const CAPTION_GAP = 0.035;
const CURSOR_REACH = 0.6;
const FLING = 0.18;
const STRIP_Y = -0.03;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const expoHalf = (y) => (Math.pow(2, SHARPNESS * (2 * y - 1)) - Math.pow(2, -SHARPNESS)) / (2 * (1 - Math.pow(2, -SHARPNESS)));
const expoInOut = (y) => (y <= 0 ? 0 : y >= 1 ? 1 : y < 0.5 ? expoHalf(y) : 1 - expoHalf(1 - y));
const hump = (x) => Math.pow(Math.sin(Math.PI * clamp01((x - SETTLE_FROM) / (1 - SETTLE_FROM))), 2);
const flick = (x) => expoInOut(1 - Math.pow(1 - clamp01(x), FRONT_LOAD)) + SETTLE * hump(x);

const photoCount = (p) => Math.max(1, Math.min(MAX_PHOTOS, Math.round(p.count)));
const heading = (p) => (p.direction === 'right' ? -1 : 1);
const pitchOf = (p) => p.cardSize + p.gap;
const heightOf = (p) => p.cardSize / Math.max(0.2, p.aspect);

function stripPlan(p, length) {
  const n = photoCount(p);
  const beat = Math.max(0.2, p.gesture) + Math.max(0, p.pause);
  const k = Math.max(1, Math.round(length / beat));
  const period = length / k;
  const move = (period * Math.max(0.2, p.gesture)) / beat;
  const laps = Math.max(Math.ceil(k / n), Math.round((k * Math.max(1, p.step)) / n));
  const total = n * laps;
  const sign = heading(p);
  const lead = (period - move) / 2;
  const gestures = Array.from({ length: k }, (_, i) => ({
    at: i * period + lead,
    end: i * period + lead + move,
    from: sign * Math.floor((i * total) / k),
    to: sign * Math.floor(((i + 1) * total) / k)
  }));
  return { gestures, length, count: n };
}

function stripPos(plan, t) {
  const laps = Math.floor(t / plan.length);
  const local = t - laps * plan.length;
  const lap = plan.gestures[plan.gestures.length - 1].to * laps;
  let pos = 0;
  for (const g of plan.gestures) {
    if (local < g.at) {
      break;
    }
    pos = g.from + (g.to - g.from) * flick((local - g.at) / (g.end - g.at));
  }
  return lap + pos;
}

function gestureAt(plan, t) {
  const local = t - Math.floor(t / plan.length) * plan.length;
  const g = plan.gestures.find((g) => local >= g.at && local <= g.end);
  return g ? { g, x: (local - g.at) / (g.end - g.at) } : null;
}

function magnifyAt(d, p) {
  return 1 + (p.magnify - 1) * (1 - smooth(clamp01(Math.abs(d) / Math.max(0.05, p.falloff))));
}

function grownBy(d, p) {
  const w = Math.max(0.05, p.falloff);
  const v = clamp01(Math.abs(d) / w);
  return Math.sign(d) * w * (v - (Math.pow(v, 6) - 3 * Math.pow(v, 5) + 2.5 * Math.pow(v, 4)));
}

const offsetAt = (d, p) => pitchOf(p) * (d + (p.magnify - 1) * grownBy(d, p));

function slotCount(p, half) {
  const n = photoCount(p);
  let slots = n;
  while (pitchOf(p) * (slots / 2 - WRAP_MARGIN) <= half + p.cardSize) {
    slots += n;
  }
  return slots;
}

const wrapped = (x, size) => x - size * Math.floor(x / size + 0.5);

function captionWeight(plan, t) {
  const at = gestureAt(plan, t);
  if (!at) {
    return 1;
  }
  return Math.max(1 - smooth(clamp01(at.x / CAPTION_OUT)), smooth(clamp01((at.x - CAPTION_IN) / (1 - CAPTION_IN))));
}

function cursorFrame(p, plan, t) {
  const at = p.cursor ? gestureAt(plan, t) : null;
  if (!at) {
    return { x: 0, y: 0, opacity: 0, press: 0 };
  }
  const sign = Math.sign(at.g.to - at.g.from);
  const shown = smooth(clamp01(at.x / 0.12)) * (1 - smooth(clamp01((at.x - 0.7) / 0.3)));
  return { x: sign * CURSOR_REACH * (0.5 - flick(at.x)) * pitchOf(p) * 2, y: STRIP_Y + heightOf(p) * 0.15, opacity: shown, press: shown };
}

function stripFrame(p, t, length, width, height, pos, calm) {
  const plan = stripPlan(p, length);
  const s = pos === undefined ? stripPos(plan, t) : pos;
  const short = Math.min(width, height);
  const half = width / short / 2;
  const n = plan.count;
  const slots = slotCount(p, half);
  const h = heightOf(p);
  const cards = Array.from({ length: slots }, (_, slot) => {
    const d = wrapped(slot - s, slots);
    const scale = magnifyAt(d, p);
    const grown = (scale - 1) / Math.max(1e-6, p.magnify - 1);
    return { slot, photo: slot % n, x: offsetAt(d, p), y: STRIP_Y - p.lift * grown, w: p.cardSize, h, scale, lift: grown, z: Math.round(grown * 100) };
  });
  const nearest = Math.round(s);
  const photo = ((nearest % n) + n) % n;
  const weight = calm === undefined ? captionWeight(plan, t) : calm;
  const near = 1 - smooth(clamp01(Math.abs(s - nearest) / 0.4));
  return {
    cards,
    caption: { photo, opacity: weight * near, x: offsetAt(nearest - s, p), y: STRIP_Y + (h * p.magnify) / 2 + CAPTION_GAP },
    cursor: cursorFrame(p, plan, t)
  };
}

const releaseTarget = (pos, velocity) => Math.round(pos + velocity * FLING);

function restAfter(plan, t) {
  const at = gestureAt(plan, t);
  if (!at) {
    return { at: t, pos: stripPos(plan, t) };
  }
  const end = t + (1 - at.x) * (at.g.end - at.g.at);
  return { at: end, pos: stripPos(plan, end) };
}
`;
