export const CAROUSEL_MODEL = String.raw`
const PERSPECTIVE = 2.6;
const MIN_ITEMS = 5;
const MOMENTUM = 0.25;
const FLICK = 0.3;
const CAPTION_WINDOW = 0.25;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const span = (t, at, length) => clamp01((t - at) / Math.max(length, 1e-6));
const smooth = (x) => x * x * x * (x * (x * 6 - 15) + 10);
const expoInOut = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2);
const expoOut = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const EASES = { inout: expoInOut, out: expoOut };
const SIGN = { next: 1, previous: -1 };

const wrapOffset = (i, pos, n) => {
  const d = (((i - pos) % n) + n) % n;
  return d >= n / 2 ? d - n : d;
};

const itemWidth = (p) => p.itemSize * p.aspect;

const ringStep = (p) => 2 * Math.asin(Math.min(1, (itemWidth(p) * (1 + p.gap)) / (2 * p.ringRadius)));

function ringSlot(d, p) {
  const angle = d * ringStep(p);
  const half = (Math.max(1, Math.round(p.visible)) - 1) / 2;
  const far = Math.abs(d);
  return {
    angle,
    x: p.ringRadius * Math.sin(angle),
    z: p.ringRadius * (Math.cos(angle) - 1),
    scale: 1 + p.lift * (1 - smooth(clamp01(far))),
    opacity: 1 - smooth(clamp01(far - half)),
    shade: p.dim * smooth(clamp01(far / (half + 1)))
  };
}

function sequencePos(t, p) {
  const interval = Math.max(0.2, p.interval);
  const move = Math.min(p.moveSeconds, interval * 0.9);
  const steps = Math.floor(t / interval);
  const within = t - steps * interval;
  return (SIGN[p.direction] ?? 1) * (steps + expoInOut(span(within, interval - move, move)));
}

function captionAt(pos, n) {
  const nearest = Math.round(pos);
  return { index: ((nearest % n) + n) % n, opacity: smooth(clamp01(1 - Math.abs(pos - nearest) / CAPTION_WINDOW)) };
}

function snapTarget(pos, velocity) {
  if (Math.abs(velocity) < FLICK) {
    return Math.round(pos);
  }
  const projected = Math.round(pos + velocity * MOMENTUM);
  return velocity > 0 ? Math.max(projected, Math.ceil(pos + 1e-9)) : Math.min(projected, Math.floor(pos - 1e-9));
}

function glide(from, to, elapsed, seconds, ease) {
  const x = span(elapsed, 0, seconds);
  return x >= 1 ? to : from + (to - from) * (EASES[ease] ?? expoInOut)(x);
}

const stepTarget = (step, dir) => (step.auto && step.moving ? Math.round(step.from) : step.to) + dir;

const dragPos = (start, dx, spacing) => start - dx / Math.max(spacing, 1);
`;
