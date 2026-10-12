import { WORD_ENTRANCE } from '../word-entrance';

export const TVS_MODEL = String.raw`
${WORD_ENTRANCE}
const MIN_TVS = 4;
const MAX_TVS = 7;
const PILE = [
  { x: 0, b: 0.06, w: 0.6, h: 0.4, finish: 'walnut', panel: 'side', legs: true, antenna: false, rank: 0 },
  { x: 0.62, b: 0, w: 0.38, h: 0.36, finish: 'cream', panel: 'bottom', legs: false, antenna: false, rank: 2 },
  { x: 0.03, b: 0.46, w: 0.4, h: 0.33, finish: 'charcoal', panel: 'side', legs: false, antenna: false, rank: 4 },
  { x: 0.62, b: 0.36, w: 0.36, h: 0.3, finish: 'oak', panel: 'bottom', legs: false, antenna: false, rank: 1 },
  { x: 0.5, b: 0.66, w: 0.42, h: 0.29, finish: 'walnut', panel: 'side', legs: false, antenna: false, rank: 6 },
  { x: 0.08, b: 0.79, w: 0.32, h: 0.25, finish: 'cream', panel: 'bottom', legs: false, antenna: true, rank: 3 },
  { x: 0.56, b: 0.95, w: 0.26, h: 0.21, finish: 'charcoal', panel: 'bottom', legs: false, antenna: true, rank: 5 }
];
const PANELS = {
  side: { x: 0.06, y: 0.1, w: 0.66, h: 0.8 },
  bottom: { x: 0.09, y: 0.08, w: 0.82, h: 0.68 }
};
const ANTENNA = 0.14;
const LINE = 0.012;
const LINE_SHARE = 0.35;
const SWITCH = 0.42;
const CHANNEL_GAP = 0.09;
const SWITCH_CLEAR = 0.3;
const CARD_DELAY = 0.45;
const TITLE_DELAY = 0.2;
const OFF_SECONDS = 0.7;
const OFF_LINE_SHARE = 0.6;
const OFF_STAGGER = 0.04;
const PULL_SECONDS = 1.8;
const COVER = 1.04;
const DRIFT = 0.04;
const FLICKER_HZ = 30;
const ROLL_SPEED = 0.22;

function tvLayout(p) {
  const n = Math.max(MIN_TVS, Math.min(MAX_TVS, Math.round(p.count) || MAX_TVS));
  const kept = PILE.slice(0, n);
  const height = Math.max(...kept.map((tv) => tv.b + tv.h + (tv.antenna ? ANTENNA : 0)));
  const ranks = kept.map((tv) => tv.rank).sort((a, b) => a - b);
  const tvs = kept.map((tv, i) => {
    const y = height - tv.b - tv.h;
    const panel = PANELS[tv.panel];
    const screen = { x: tv.x + tv.w * panel.x, y: y + tv.h * panel.y, w: tv.w * panel.w, h: tv.h * panel.h };
    return { ...tv, i, y, screen, order: ranks.indexOf(tv.rank) };
  });
  const area = (tv) => tv.screen.w * tv.screen.h;
  const hero = tvs.reduce((best, tv) => (area(tv) > area(tvs[best]) ? tv.i : best), 0);
  return { tvs, width: 1, height, hero };
}

const bump = (x) => (x <= 0 || x >= 1 ? 0 : x < 0.5 ? smooth(2 * x) : smooth(2 - 2 * x));

function switchTimes(p, order) {
  const times = [];
  for (let at = p.firstSwitch; at + order * CHANNEL_GAP < p.pushAt - SWITCH_CLEAR; at += Math.max(0.5, p.channelSeconds)) {
    times.push(at + order * CHANNEL_GAP);
  }
  return times;
}

const cardAt = (p) => p.pushAt + CARD_DELAY;
const offAt = (p, length, order) => length - PULL_SECONDS - OFF_SECONDS - order * OFF_STAGGER;

function powerOf(p, t, length, order) {
  const on = span(t, p.onAt + order * p.onStagger, p.onSeconds);
  const line = expoInOut(clamp01(on / LINE_SHARE));
  const open = expoInOut(clamp01((on - LINE_SHARE) / (1 - LINE_SHARE)));
  const off = p.leave ? span(t, offAt(p, length, order), OFF_SECONDS) : 0;
  const close = expoInOut(clamp01(off / OFF_LINE_SHARE));
  const shut = expoInOut(clamp01((off - OFF_LINE_SHARE) / (1 - OFF_LINE_SHARE)));
  return {
    sx: line * (1 - shut),
    sy: LINE + (1 - LINE) * open * (1 - close),
    flash: line * (1 - open) + close * (1 - shut),
    power: open * (1 - close)
  };
}

const hash = (a, b) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function screenFrame(tv, hero, p, t, length) {
  const power = powerOf(p, t, length, tv.order);
  const switches = switchTimes(p, tv.order).concat(tv.i === hero ? [cardAt(p)] : []);
  const passed = switches.filter((at) => t >= at + SWITCH / 2).length;
  const card = tv.i === hero && t >= cardAt(p) + SWITCH / 2;
  return {
    ...power,
    sy: power.sx > 0 ? power.sy : LINE,
    channel: card ? passed - 1 : passed,
    card,
    noise: Math.max(0, ...switches.map((at) => bump(span(t, at, SWITCH)))),
    flicker: hash(Math.floor(t * FLICKER_HZ), tv.i),
    roll: (t * ROLL_SPEED + tv.i * 0.37) % 1
  };
}

const channelCount = (p, tv) => switchTimes(p, tv.order).length + 1;

function cameraOf(layout, p, t, length, width, height) {
  const fit = Math.min((width * p.wallSize) / layout.width, (height * p.wallSize) / layout.height);
  const screen = layout.tvs[layout.hero].screen;
  const zoomIn = Math.max(width / (screen.w * fit), height / (screen.h * fit)) * COVER;
  const pull = p.leave ? expoInOut(span(t, length - PULL_SECONDS, PULL_SECONDS)) : 0;
  const push = expoInOut(span(t, p.pushAt, p.pushSeconds)) * (1 - pull);
  const drift = 1 + DRIFT * smooth(span(t, 0, p.pushAt + p.pushSeconds)) * (1 - pull);
  const scale = Math.exp(Math.log(zoomIn) * push);
  const toward = zoomIn > 1 ? (1 - 1 / scale) / (1 - 1 / zoomIn) : 0;
  const rest = { x: layout.width / 2, y: layout.height / 2 };
  const target = { x: screen.x + screen.w / 2, y: screen.y + screen.h / 2 };
  return { fit, zoomIn, scale: scale * drift, fx: rest.x + (target.x - rest.x) * toward, fy: rest.y + (target.y - rest.y) * toward };
}

const titleWords = (title) => String(title || '').trim().split(/\s+/).filter(Boolean);

function tvFrame(layout, p, t, length, width, height) {
  const titleAt = cardAt(p) + SWITCH / 2 + TITLE_DELAY;
  const words = titleWords(p.title).map((_, i) => {
    const e = wordIn(t, titleAt + i * WORD_GAP);
    return { y: e.rise, opacity: e.opacity };
  });
  return {
    ...cameraOf(layout, p, t, length, width, height),
    screens: layout.tvs.map((tv) => screenFrame(tv, layout.hero, p, t, length)),
    words
  };
}
`;
