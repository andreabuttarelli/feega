import { WORD_ENTRANCE } from '../word-entrance';

export const SCROLL_MODEL = String.raw`
${WORD_ENTRANCE}
const RAMP = 0.8;
const EXIT = 0.7;
const MIN_LAND_HOLD = 0.6;
const BRAKE_SHARPNESS = 10;
const MAX_LINES = 240;
const LINE_HEIGHT = 1.15;
const LINE_LAG = 0.25;
const LINE_GAP = 0.12;
const LAND_LEAD = 0.75;

const smoothArea = (x) => x * x * x * x * (x * (x - 3) + 2.5);

const BRAKE_FLOOR = Math.pow(2, -BRAKE_SHARPNESS);
const brake = (x) => (1 - Math.pow(2, -BRAKE_SHARPNESS * x)) / (1 - BRAKE_FLOOR);
const brakeRate = (x) => (BRAKE_SHARPNESS * Math.LN2 * Math.pow(2, -BRAKE_SHARPNESS * x)) / (1 - BRAKE_FLOOR);

function frameBox(width, height) {
  const short = Math.min(width, height);
  return { ax: width / short / 2, ay: height / short / 2 };
}

const lineList = (raw) => String(raw || '').split('\n').map((s) => s.trim()).filter(Boolean);

function scrollLayout(p, width, height) {
  const box = frameBox(width, height);
  const texts = lineList(p.lines);
  const base = texts.length ? texts : [' '];
  const count = Math.min(MAX_LINES, base.length * Math.max(1, Math.round(p.repeat)));
  const lineSize = p.fontSize / 100;
  const pitch = lineSize * LINE_HEIGHT * p.lineSpacing;
  const titleHalf = lineSize / 2;
  const first = titleHalf + p.gap;
  const last = first + (count - 1) * pitch;
  const clear = Math.max(p.gap + titleHalf, box.ay + titleHalf + pitch);
  const lines = Array.from({ length: count }, (_, k) => ({ y: first + k * pitch, text: base[k % base.length] }));
  const words = (raw) => Math.max(1, String(raw || '').trim().split(/\s+/).filter(Boolean).length);
  return { box, pitch, lines, lineSize, closeY: last + clear, openWords: words(p.openTitle), closeWords: words(p.closeTitle) };
}

function phases(p, length) {
  const start = p.titleAt + WORD_IN + p.holdSeconds;
  const exit = p.leave ? EXIT : 0;
  const parts = [RAMP, p.readSeconds, p.accelSeconds, p.brakeSeconds];
  const room = Math.max(0.5, length - exit - MIN_LAND_HOLD - start);
  const fit = Math.min(1, room / parts.reduce((a, b) => a + b, 0));
  const [ramp, read, accel, brakeFor] = parts.map((d) => d * fit);
  return { start, ramp, read, accel, brake: brakeFor, land: start + ramp + read + accel + brakeFor, leave: length - exit, exit };
}

function speedPlan(layout, p, length) {
  const ph = phases(p, length);
  const vr = p.readSpeed;
  const k = Math.max(1, p.accelCurve);
  const total = layout.closeY / layout.pitch;
  const slow = (vr * ph.ramp) / 2 + vr * ph.read + vr * ph.accel - (vr * ph.accel) / (k + 1);
  const reach = ph.accel / (k + 1) + ph.brake / brakeRate(0);
  const peak = Math.max(vr, (total - slow) / reach);
  return { ...ph, vr, k, peak, total, before: total - (peak * ph.brake) / brakeRate(0) };
}

function travel(plan, t) {
  const { start, ramp, read, accel, vr, k, peak } = plan;
  if (t <= start) {
    return { s: 0, v: 0 };
  }
  let u = t - start;
  if (u < ramp) {
    return { s: vr * ramp * smoothArea(u / ramp), v: vr * smooth(u / ramp) };
  }
  u -= ramp;
  const ramped = (vr * ramp) / 2;
  if (u < read) {
    return { s: ramped + vr * u, v: vr };
  }
  u -= read;
  const readEnd = ramped + vr * read;
  if (u < accel) {
    const x = u / accel;
    return { s: readEnd + vr * u + ((peak - vr) * accel * Math.pow(x, k + 1)) / (k + 1), v: vr + (peak - vr) * Math.pow(x, k) };
  }
  u -= accel;
  if (u < plan.brake) {
    const x = u / plan.brake;
    return { s: plan.before + (plan.total - plan.before) * brake(x), v: (peak * brakeRate(x)) / brakeRate(0) };
  }
  return { s: plan.total, v: 0 };
}

const wordsFrom = (n, at, t) => Array.from({ length: n }, (_, i) => wordIn(t, at + i * WORD_GAP));

function lineLooks(layout, p, t) {
  const at = p.titleAt + (layout.openWords - 1) * WORD_GAP + LINE_LAG;
  const seen = layout.box.ay + layout.pitch;
  return layout.lines.map((line, k) => (line.y - layout.lineSize / 2 < seen ? wordIn(t, at + k * LINE_GAP) : { progress: 1, rise: 0, opacity: 1 }));
}

function scrollFrame(layout, p, t, length, fps) {
  const plan = speedPlan(layout, p, length);
  const move = travel(plan, t);
  const out = p.leave ? expoInOut(span(t, plan.leave, plan.exit)) : 0;
  const shift = move.v / fps;
  return {
    camera: move.s * layout.pitch,
    speed: move.v,
    shift,
    streak: p.motionBlur * shift,
    open: wordsFrom(layout.openWords, p.titleAt, t),
    lines: lineLooks(layout, p, t),
    close: wordsFrom(layout.closeWords, plan.land - LAND_LEAD, t),
    closeOut: { opacity: 1 - smooth(out), y: -0.1 * out },
    land: plan.land
  };
}
`;
