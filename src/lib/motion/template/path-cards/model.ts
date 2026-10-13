import { WORD_ENTRANCE } from '../word-entrance';

export const PATH_MODEL = String.raw`
${WORD_ENTRANCE}
const MAX_STOPS = 6;
const GAP = 0.66;
const AMP = 0.2;
const SAMPLES = 48;
const PLACE_OUT = 0.2;
const PLACE_BACK = 0.05;
const REVIEW_ALONG = 0.25;
const REVIEW_IN = 0.13;
const VIEW_AHEAD = 0.1;
const CAMERA_CROSS = 0.5;
const STOP_SLOW = 0.22;
const DOT_IN_PAST_START = 0.3;
const PLACE_LEAD = 0.25;
const REVIEW_LAG = 0.1;
const POP_FADE = 0.45;
const POP_GROW = 0.9;
const POP_FROM = 0.88;
const POP_RISE = 0.03;
const SHARP_NEAR = 0.65;
const BLUR_SPAN = 0.7;
const PUSH = 0.08;
const BASE_ZOOM = 0.84;
const STOP_ZOOM = 0.12;
const STOP_ZOOM_SPAN = 1.1;
const LEAVE = 1.0;
const LEAVE_END = 0.3;

const listOf = (raw) => String(raw || '').split('|').map((s) => s.trim()).filter(Boolean);
const stopCount = (p) => Math.max(1, Math.min(MAX_STOPS, listOf(p.places).length));
const lerp = (a, b, k) => a + (b - a) * k;

function catmull(a, b, c, d, k) {
  const k2 = k * k;
  const k3 = k2 * k;
  const at = (p0, p1, p2, p3) => 0.5 * (2 * p1 + (p2 - p0) * k + (2 * p0 - 5 * p1 + 4 * p2 - p3) * k2 + (3 * p1 - p0 - 3 * p2 + p3) * k3);
  return { x: at(a.x, b.x, c.x, d.x), y: at(a.y, b.y, c.y, d.y) };
}

function pathLayout(p, aspect) {
  const n = stopCount(p);
  const axis = aspect >= 1 ? { x: 1, y: 0 } : { x: 0, y: 1 };
  const normal = { x: axis.y, y: axis.x };
  const crossOf = (i) => (i % 2 === 0 ? -AMP : AMP);
  const at = (main, cross) => ({ x: axis.x * main + normal.x * cross, y: axis.y * main + normal.y * cross });
  const ways = [at(-GAP, AMP * 0.3), ...Array.from({ length: n }, (_, i) => at(i * GAP, crossOf(i))), at(n * GAP, crossOf(n) * 0.6)];
  const points = [ways[0]];
  const ends = [0];
  for (let i = 0; i < ways.length - 1; i++) {
    const a = ways[Math.max(0, i - 1)];
    const d = ways[Math.min(ways.length - 1, i + 2)];
    for (let k = 1; k <= SAMPLES; k++) {
      points.push(catmull(a, ways[i], ways[i + 1], d, k / SAMPLES));
    }
    ends.push(points.length - 1);
  }
  const run = [0];
  for (let i = 1; i < points.length; i++) {
    run.push(run[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  }
  const length = run[run.length - 1];
  const s = run.map((r) => r / length);
  const wayS = ends.map((e) => s[e]);
  const stops = Array.from({ length: n }, (_, i) => ({ s: wayS[i + 1], x: ways[i + 1].x, y: ways[i + 1].y, side: Math.sign(crossOf(i)) }));
  const cards = stops.flatMap((stop, i) => {
    const place = { x: stop.x + normal.x * stop.side * PLACE_OUT - axis.x * PLACE_BACK, y: stop.y + normal.y * stop.side * PLACE_OUT - axis.y * PLACE_BACK };
    const review = { x: place.x + axis.x * REVIEW_ALONG - normal.x * stop.side * REVIEW_IN, y: place.y + axis.y * REVIEW_ALONG - normal.y * stop.side * REVIEW_IN };
    return [{ stop: i, kind: 'place', ...place }, { stop: i, kind: 'review', ...review }];
  });
  return { points, s, length, wayS, stops, cards, axis, normal };
}

function stopTimes(layout, p, length) {
  const every = p.moveSeconds + p.holdSeconds;
  const last = p.moveSeconds + every * (layout.stops.length - 1);
  const room = length - (p.leave ? LEAVE + LEAVE_END : 0) - p.startAt;
  const fit = Math.min(1, room / Math.max(1e-6, last));
  return layout.stops.map((_, i) => p.startAt + (p.moveSeconds + every * i) * fit);
}

function travelKnots(layout, p, length) {
  const knots = [{ t: p.startAt, s: 0 }, ...stopTimes(layout, p, length).map((t, i) => ({ t, s: layout.stops[i].s })), { t: length, s: 1 }];
  const pace = knots.slice(1).map((k, i) => (k.s - knots[i].s) / Math.max(1e-6, k.t - knots[i].t));
  return knots.map((k, i) => {
    const first = i === 0;
    const last = i === knots.length - 1;
    const v = first ? 0 : last ? pace[i - 1] : STOP_SLOW * Math.min(pace[i - 1], pace[i]);
    return { ...k, v };
  });
}

function quintic(a, b, t) {
  const d = b.t - a.t;
  const u = clamp01((t - a.t) / Math.max(1e-6, d));
  const u3 = u * u * u;
  const u4 = u3 * u;
  const u5 = u4 * u;
  const rise = 10 * u3 - 15 * u4 + 6 * u5;
  const leaveV = u - 6 * u3 + 8 * u4 - 3 * u5;
  const arriveV = -4 * u3 + 7 * u4 - 3 * u5;
  return a.s + (b.s - a.s) * rise + d * (a.v * leaveV + b.v * arriveV);
}

function drawnAt(knots, t) {
  if (t <= knots[0].t) {
    return 0;
  }
  const i = knots.findIndex((k) => k.t >= t);
  if (i < 0) {
    return 1;
  }
  return quintic(knots[i - 1], knots[i], t);
}

function pointAt(layout, s) {
  const i = Math.max(1, layout.s.findIndex((v) => v >= s));
  const a = layout.points[i - 1];
  const b = layout.points[i];
  const k = clamp01((s - layout.s[i - 1]) / Math.max(1e-9, layout.s[i] - layout.s[i - 1]));
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
}

function cameraAt(layout, head) {
  const main = head.x * layout.axis.x + head.y * layout.axis.y + VIEW_AHEAD;
  const cross = (head.x * layout.normal.x + head.y * layout.normal.y) * CAMERA_CROSS;
  return { x: layout.axis.x * main + layout.normal.x * cross, y: layout.axis.y * main + layout.normal.y * cross };
}

function stopZoom(arrivals, t) {
  return arrivals.reduce((sum, at) => sum + STOP_ZOOM * smooth(clamp01(1 - Math.abs(t - at) / STOP_ZOOM_SPAN)), 0);
}

function cardAt(card, arrive, t, camera, p) {
  const at = card.kind === 'place' ? arrive - PLACE_LEAD : arrive + REVIEW_LAG;
  const grow = landSoftly(span(t, at, POP_GROW));
  const far = Math.hypot(card.x - camera.x, card.y - camera.y);
  return {
    x: card.x,
    y: card.y,
    opacity: smooth(span(t, at, POP_FADE)),
    scale: POP_FROM + (1 - POP_FROM) * grow,
    rise: POP_RISE * (1 - grow),
    blur: p.blur * smooth(clamp01((far - SHARP_NEAR) / BLUR_SPAN))
  };
}

function pathFrame(layout, p, t, length) {
  const knots = travelKnots(layout, p, length);
  const arrivals = knots.slice(1, -1).map((k) => k.t);
  const drawn = drawnAt(knots, t);
  const head = pointAt(layout, drawn);
  const camera = cameraAt(layout, head);
  return {
    drawn,
    head,
    dot: smooth(span(t, 0, p.startAt + DOT_IN_PAST_START)),
    camera,
    zoom: BASE_ZOOM + PUSH * clamp01(t / length) + stopZoom(arrivals, t),
    fade: p.leave ? 1 - smooth(span(t, length - LEAVE - LEAVE_END, LEAVE)) : 1,
    cards: layout.cards.map((card) => cardAt(card, arrivals[card.stop], t, camera, p))
  };
}
`;
