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
const START_VIEW = 0.6;
const END_VIEW = 0.5;
const VIEW_AHEAD = -0.12;
const VIEW_OUT = 0.04;
const CAMERA_LAG = 0.1;
const CAMERA_TAIL = 0.5;
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
  const view = (w, ahead, out) => at(w.x * axis.x + w.y * axis.y + ahead, out);
  const views = [view(ways[0], START_VIEW, 0), ...stops.map((st) => view(st, VIEW_AHEAD, st.side * VIEW_OUT)), view(ways[ways.length - 1], -END_VIEW, 0)];
  return { points, s, length, wayS, stops, cards, views };
}

function moveStart(p, k) {
  return p.startAt + k * (p.moveSeconds + p.holdSeconds);
}

function drawnAt(layout, p, t) {
  let drawn = 0;
  for (let k = 0; k < layout.wayS.length - 1; k++) {
    drawn = lerp(drawn, layout.wayS[k + 1], expoInOut(span(t, moveStart(p, k), p.moveSeconds)));
  }
  return drawn;
}

function pointAt(layout, s) {
  const i = Math.max(1, layout.s.findIndex((v) => v >= s));
  const a = layout.points[i - 1];
  const b = layout.points[i];
  const k = clamp01((s - layout.s[i - 1]) / Math.max(1e-9, layout.s[i] - layout.s[i - 1]));
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
}

function cameraAt(layout, p, t) {
  let cam = { ...layout.views[0] };
  for (let k = 0; k < layout.views.length - 1; k++) {
    const e = expoInOut(span(t, moveStart(p, k) + CAMERA_LAG, p.moveSeconds + CAMERA_TAIL));
    cam = { x: lerp(cam.x, layout.views[k + 1].x, e), y: lerp(cam.y, layout.views[k + 1].y, e) };
  }
  return cam;
}

function cardAt(card, p, t, camera) {
  const arrive = moveStart(p, card.stop) + p.moveSeconds;
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
  const drawn = drawnAt(layout, p, t);
  const camera = cameraAt(layout, p, t);
  return {
    drawn,
    head: pointAt(layout, drawn),
    dot: smooth(span(t, 0, p.startAt)),
    camera,
    zoom: BASE_ZOOM + PUSH * clamp01(t / length),
    fade: p.leave ? 1 - smooth(span(t, length - LEAVE - LEAVE_END, LEAVE)) : 1,
    cards: layout.cards.map((card) => cardAt(card, p, t, camera))
  };
}
`;
