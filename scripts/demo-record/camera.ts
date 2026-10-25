export enum Aspect {
  Landscape = '16x9',
  Portrait = '9x16'
}

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };
export type Size = { width: number; height: number };

export type DemoEvent =
  | { kind: 'click'; t: number; x: number; y: number; fit?: Rect }
  | { kind: 'type'; t: number; end: number; rect: Rect }
  | { kind: 'drag'; t: number; end: number; from: Point; to: Point; fit?: Rect };

export type Keyframe = { t: number; cx: number; cy: number; zoom: number };

const RATIO: Record<Aspect, number> = { [Aspect.Landscape]: 16 / 9, [Aspect.Portrait]: 9 / 16 };

const CLICK_ZOOM = 2.1;
const MIN_ZOOM = 1.8;
const MAX_ZOOM = 2.5;
const DRAG_MIN_ZOOM = 1.4;
const FIELD_SHARE = 0.6;
const FIT_SHARE = 0.7;
const PORTRAIT_ZOOM_SHARE = 0.5;
const TRAVEL_S = 0.8;
const HOLD_S = 1.1;
const CLICK_HOLD_S = 2;
const OUT_S = 0.9;
const WIDE_GAP_S = 2.4;
const WIDE = 1;

type Shot = { start: number; end: number; cx: number; cy: number; zoom: number };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function fitted(fit: Rect, view: Size, start: number, end: number): Shot {
  const zoom = clamp(Math.min((view.width * FIT_SHARE) / fit.width, (view.height * FIT_SHARE) / fit.height), 1, MAX_ZOOM);
  return { start, end, cx: fit.x + fit.width / 2, cy: fit.y + fit.height / 2, zoom };
}

function around(fit: Rect, p: Point): Rect {
  const x = Math.min(fit.x, p.x);
  const y = Math.min(fit.y, p.y);
  return { x, y, width: Math.max(fit.x + fit.width, p.x) - x, height: Math.max(fit.y + fit.height, p.y) - y };
}

function shotOf(e: DemoEvent, view: Size): Shot {
  if (e.kind === 'click' && e.fit) {
    return fitted(around(e.fit, e), view, e.t, e.t + CLICK_HOLD_S);
  }
  if (e.kind === 'click') {
    return { start: e.t, end: e.t + CLICK_HOLD_S, cx: e.x, cy: e.y, zoom: CLICK_ZOOM };
  }
  if (e.kind === 'type') {
    const zoom = clamp((view.width * FIELD_SHARE) / Math.max(e.rect.width, 1), MIN_ZOOM, MAX_ZOOM);
    return { start: e.t, end: e.end + HOLD_S, cx: e.rect.x + e.rect.width / 2, cy: e.rect.y + e.rect.height / 2, zoom };
  }
  if (e.fit) {
    return fitted(e.fit, view, e.t, e.end + HOLD_S);
  }
  const span = Math.max(Math.abs(e.to.x - e.from.x), Math.abs(e.to.y - e.from.y) * (view.width / view.height), 1);
  const zoom = clamp((view.width * FIELD_SHARE) / span, DRAG_MIN_ZOOM, MAX_ZOOM - 0.3);
  return { start: e.t, end: e.end + HOLD_S, cx: (e.from.x + e.to.x) / 2, cy: (e.from.y + e.to.y) / 2, zoom };
}

export function keyframesOf(events: DemoEvent[], view: Size, duration: number): Keyframe[] {
  const shots = events.map((e) => shotOf(e, view)).sort((a, b) => a.start - b.start);
  const wideAt = (t: number, near: Shot | undefined): Keyframe => ({ t, cx: near?.cx ?? view.width / 2, cy: near?.cy ?? view.height / 2, zoom: WIDE });
  const keys: Keyframe[] = [wideAt(0, shots[0])];

  for (const [i, shot] of shots.entries()) {
    const last = keys[keys.length - 1];
    const previous = shots[i - 1];
    if (previous && shot.start - previous.end > WIDE_GAP_S) {
      keys.push(wideAt(previous.end + OUT_S, shot));
      keys.push(wideAt(shot.start - TRAVEL_S, shot));
    } else if (!previous) {
      keys.push(wideAt(Math.max(0, shot.start - TRAVEL_S), shot));
    }
    const arrive = Math.max(shot.start, keys[keys.length - 1].t + 0.3, last.t + 0.3);
    keys.push({ t: arrive, cx: shot.cx, cy: shot.cy, zoom: shot.zoom });
    keys.push({ t: Math.max(arrive, shot.end), cx: shot.cx, cy: shot.cy, zoom: shot.zoom });
  }

  const tail = keys[keys.length - 1];
  keys.push({ ...tail, t: Math.min(duration, tail.t + OUT_S), zoom: WIDE });
  keys.push({ ...tail, t: Math.max(duration, tail.t + OUT_S), zoom: WIDE });
  return keys;
}

export const easeInOutExpo = (p: number) => {
  if (p <= 0) {
    return 0;
  }
  if (p >= 1) {
    return 1;
  }
  return p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2;
};

function interpolate(keys: Keyframe[], t: number): Keyframe {
  const next = keys.findIndex((k) => k.t > t);
  if (next <= 0) {
    return next === 0 ? keys[0] : keys[keys.length - 1];
  }
  const a = keys[next - 1];
  const b = keys[next];
  const p = easeInOutExpo((t - a.t) / (b.t - a.t));
  const zoom = Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * p);
  return { t, cx: a.cx + (b.cx - a.cx) * p, cy: a.cy + (b.cy - a.cy) * p, zoom };
}

function baseWindow(view: Size, aspect: Aspect): Size {
  const ratio = RATIO[aspect];
  if (view.width / view.height > ratio) {
    return { width: view.height * ratio, height: view.height };
  }
  return { width: view.width, height: view.width / ratio };
}

export function cameraAt(keys: Keyframe[], t: number, view: Size, aspect: Aspect): Rect {
  const k = interpolate(keys, t);
  const base = baseWindow(view, aspect);
  const zoom = aspect === Aspect.Portrait ? 1 + (k.zoom - 1) * PORTRAIT_ZOOM_SHARE : k.zoom;
  const width = base.width / zoom;
  const height = base.height / zoom;
  return {
    x: clamp(k.cx - width / 2, 0, view.width - width),
    y: clamp(k.cy - height / 2, 0, view.height - height),
    width,
    height
  };
}
