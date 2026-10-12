export const FLOAT_MODEL = String.raw`
const PERSPECTIVE = 1.8;
const MAX_CARDS = 12;
const CARD_RATIO = 1.25;
const SETTLE = 0.012;
const ENTER = 1.6;
const EXIT = 1.1;
const WORD_IN = 1.1;
const WORD_GAP = 0.12;
const NATURAL = 2 * Math.PI * 0.12;
const PUSH_OUT = 1.06;
const PUSH_STEPS = 60;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const span = (t, at, length) => clamp01((t - at) / Math.max(length, 1e-6));
const expoInOut = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2);
const settle = (x) => expoInOut(x) + SETTLE * Math.sin(Math.PI * clamp01((x - 0.5) / 0.5));
const smooth = (x) => x * x * x * (x * (x * 6 - 15) + 10);

const hash01 = (i, salt) => {
  let h = Math.imul(i + 1, 374761393) ^ Math.imul(salt + 7, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const signed = (i, salt) => 2 * hash01(i, salt) - 1;

const scaleAt = (z) => PERSPECTIVE / (PERSPECTIVE - z);

function frameBox(width, height) {
  const short = Math.min(width, height);
  return { ax: width / short / 2, ay: height / short / 2 };
}

function safeBox(p, box) {
  return { hw: Math.min(box.ax * 0.92, (p.safeWidth * box.ax * 2) / 2), hh: p.safeHeight / 2 };
}

function footprint(card, margin) {
  const s = scaleAt(card.z);
  return { x: card.x * s, y: card.y * s, hw: (card.w / 2 + margin) * s * 1.08, hh: (card.h / 2 + margin) * s * 1.08 };
}

const overlaps = (f, safe) => Math.abs(f.x) < f.hw + safe.hw && Math.abs(f.y) < f.hh + safe.hh;

function seeds(layout, n, box, depth) {
  const cards = [];
  if (layout === 'grid-depth') {
    const cols = Math.max(3, Math.round(Math.sqrt((n + 4) * box.ax / box.ay)));
    const rows = Math.max(2, Math.ceil((n + 4) / cols));
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = ((c + 0.5) / cols * 2 - 1) * box.ax * 0.86;
        const y = ((r + 0.5) / rows * 2 - 1) * box.ay * 0.82;
        cells.push({ x, y, far: Math.hypot(x / box.ax, y / box.ay) });
      }
    }
    cells.sort((a, b) => b.far - a.far);
    return cells.slice(0, n).map((cell, i) => ({ x: cell.x, y: cell.y, z: -depth * (0.2 + 0.8 * hash01(i, 3)) }));
  }
  for (let i = 0; i < n; i++) {
    if (layout === 'cloud') {
      cards.push({ x: signed(i, 11) * box.ax * 0.9, y: signed(i, 12) * box.ay * 0.9, z: -depth * hash01(i, 13) + 0.12 * depth * signed(i, 14) });
      continue;
    }
    const angle = (2 * Math.PI * i) / n + 0.35 * signed(i, 21) / n + Math.PI / 2;
    const ring = 0.78 + 0.16 * signed(i, 22);
    cards.push({ x: Math.cos(angle) * box.ax * ring, y: Math.sin(angle) * box.ay * ring, z: -depth * (i % 2 ? 0.75 : 0.15) + 0.1 * depth * signed(i, 23) });
  }
  return cards;
}

function floatLayout(p, width, height) {
  const box = frameBox(width, height);
  const safe = safeBox(p, box);
  const n = Math.max(1, Math.min(MAX_CARDS, Math.round(p.count)));
  const depth = Math.max(0, p.depth);
  return seeds(p.layout, n, box, depth).map((seed, i) => {
    const w = p.cardSize * (0.8 + 0.4 * hash01(i, 31));
    const card = { ...seed, w, h: w * CARD_RATIO, i };
    for (let step = 0; step < PUSH_STEPS && overlaps(footprint(card, p.drift), safe); step++) {
      const away = card.x === 0 && card.y === 0 ? { x: 0, y: 1e-3 } : card;
      card.x = away.x * PUSH_OUT;
      card.y = away.y * PUSH_OUT;
    }
    return { ...card, phase: hash01(i, 41) * 2 * Math.PI, tilt: signed(i, 42) };
  });
}

function cycles(p, length) {
  return Math.max(1, Math.round((p.speed * length) / 10));
}

function damped(omega, resistance) {
  const r = omega / NATURAL;
  const zeta = Math.max(0.05, resistance);
  return { gain: 1 / Math.hypot(1 - r * r, 2 * zeta * r), lag: Math.atan2(2 * zeta * r, 1 - r * r) };
}

function drift(card, p, t, length) {
  const base = (2 * Math.PI * cycles(p, length)) / length;
  const axis = (salt, harmonic) => {
    const omega = base * harmonic;
    const { gain, lag } = damped(omega, p.resistance);
    const unit = damped(0, p.resistance).gain;
    return (gain / Math.max(gain, unit)) * Math.sin(omega * t + card.phase + salt - lag) / harmonic;
  };
  const wobble = (salt) => 0.75 * axis(salt, 1) + 0.25 * axis(salt * 1.7, 2);
  return {
    x: p.drift * wobble(1.3),
    y: p.drift * wobble(2.9),
    z: p.drift * 0.6 * wobble(4.1),
    rx: 6 * p.drift / 0.04 * wobble(5.3),
    ry: 8 * p.drift / 0.04 * wobble(6.7)
  };
}

function entranceAt(card, n, p, t, length) {
  if (!p.entrance) {
    return { in: 1, out: 0 };
  }
  const at = p.enterAt + card.i * p.stagger;
  const leave = p.leave ? length - EXIT - (n - 1 - card.i) * p.stagger * 0.4 : Infinity;
  return { in: span(t, at, ENTER), out: span(t, leave - 0.05, EXIT) };
}

function cardFrame(card, n, p, t, length) {
  const d = drift(card, p, t, length);
  const e = entranceAt(card, n, p, t, length);
  const arrive = settle(e.in);
  const leave = expoInOut(e.out);
  const away = (1 - arrive) + leave;
  const z = card.z + d.z - away * (1.2 + p.depth);
  const sight = scaleAt(card.z + d.z) / scaleAt(z);
  const visible = smooth(clamp01(e.in * 1.6)) * (1 - smooth(e.out));
  const depthShare = p.depth > 0 ? clamp01(-z / (p.depth + 1.2)) : 0;
  return {
    x: (card.x + d.x) * sight,
    y: (card.y + d.y) * sight,
    z,
    w: card.w,
    h: card.h,
    rx: -card.y * 14 * p.tilt + d.rx,
    ry: card.x * 18 * p.tilt + d.ry,
    rz: card.tilt * 4 * p.tilt,
    opacity: visible,
    blur: p.focusBlur * Math.max(0, depthShare - 0.15) + 8 * away,
    dim: p.dim * depthShare
  };
}

function wordFrames(words, p, t, length) {
  return words.map((_, i) => {
    const at = p.titleAt + i * WORD_GAP;
    const e = settle(span(t, at, WORD_IN));
    const out = p.leave ? expoInOut(span(t, length - EXIT - 0.2 + i * 0.04, EXIT * 0.8)) : 0;
    const shown = smooth(span(t, at, WORD_IN * 0.7)) * (1 - smooth(out));
    return { y: 0.42 * (1 - e) - 0.2 * out, blur: p.titleBlur * (1 - e + out), opacity: shown };
  });
}

function floatFrame(layout, p, t, length) {
  const words = String(p.title || '').trim().split(/\s+/).filter(Boolean);
  const push = p.push * Math.pow(Math.sin((Math.PI * clamp01(t / length))), 2);
  const sub = p.leave ? 1 - smooth(span(t, length - EXIT - 0.2, EXIT * 0.8)) : 1;
  return {
    cards: layout.map((card) => cardFrame(card, layout.length, p, t, length)),
    words: wordFrames(words, p, t, length),
    subtitle: smooth(span(t, p.titleAt + 0.35 + words.length * WORD_GAP, 0.8)) * sub,
    camera: push
  };
}
`;
