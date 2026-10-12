export const STRIP_MODEL = String.raw`
const TAIL_SHARE = 1.25;
const MAX_PHOTOS = 12;
const WRAP_MARGIN = 2;
const CAPTION_OUT = 0.12;
const CAPTION_SETTLED = 0.95;
const CAPTION_GAP = 0.035;
const CURSOR_REACH = 0.6;
const FLING = 0.18;
const STRIP_Y = -0.03;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const flick = (x) => {
  const u = clamp01(x);
  return u * u * u * (35 + u * (-105 + u * (126 + u * (-70 + u * 15))));
};

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
  const window = Math.min(length, move + TAIL_SHARE * (period - move));
  const laps = Math.max(Math.ceil(k / n), Math.round((k * Math.max(1, p.step)) / n));
  const total = n * laps;
  const sign = heading(p);
  const gestures = Array.from({ length: k }, (_, i) => ({
    at: i * period,
    end: (i + 1) * period,
    window,
    from: sign * Math.floor((i * total) / k),
    to: sign * Math.floor(((i + 1) * total) / k)
  }));
  return { gestures, length, count: n, total: sign * total };
}

function stripPos(plan, t) {
  const laps = Math.floor(t / plan.length);
  const local = t - laps * plan.length;
  let pos = (laps - 1) * plan.total;
  for (const lap of [-1, 0]) {
    for (const g of plan.gestures) {
      pos += (g.to - g.from) * flick((local - lap * plan.length - g.at) / g.window);
    }
  }
  return pos;
}

function gestureAt(plan, t) {
  const local = t - Math.floor(t / plan.length) * plan.length;
  const g = plan.gestures.find((g) => local >= g.at && local < g.end) ?? plan.gestures[plan.gestures.length - 1];
  return { g, x: (local - g.at) / (g.end - g.at) };
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

function captionWeight(plan, t, lead) {
  const at = gestureAt(plan, t);
  if (!at) {
    return 1;
  }
  return Math.max(1 - smooth(clamp01(at.x / CAPTION_OUT)), smooth(clamp01((at.x - (CAPTION_SETTLED - lead)) / Math.max(1e-3, lead))));
}

function cursorFrame(p, plan, t) {
  const at = p.cursor ? gestureAt(plan, t) : null;
  const reach = at ? flick((at.x * (at.g.end - at.g.at)) / at.g.window) : 0;
  if (!at) {
    return { x: 0, y: 0, opacity: 0, press: 0 };
  }
  const sign = Math.sign(at.g.to - at.g.from);
  const shown = smooth(clamp01(at.x / 0.12)) * (1 - smooth(clamp01((at.x - 0.7) / 0.3)));
  return { x: sign * CURSOR_REACH * (0.5 - reach) * pitchOf(p) * 2, y: STRIP_Y + heightOf(p) * 0.15, opacity: shown, press: shown };
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
  const weight = calm === undefined ? captionWeight(plan, t, p.captionLead ?? 0.4) : calm;
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
  const next = t + (1 - at.x) * (at.g.end - at.g.at);
  return { at: next, pos: stripPos(plan, next) };
}
`;
