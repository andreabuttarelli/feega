import { WORD_ENTRANCE } from '../word-entrance';

export const FLOAT_MODEL = String.raw`
${WORD_ENTRANCE}
const PERSPECTIVE = 1.8;
const MAX_CARDS = 12;
const CARD_RATIO = 1.25;
const SETTLE = 0.012;
const ENTER = 1.6;
const EXIT = 1.1;
const NATURAL = 2 * Math.PI * 0.12;
const PUSH_OUT = 1.06;
const PUSH_STEPS = 80;
const SHRINK = 0.95;
const RELAX_ROUNDS = 40;
const GOLDEN_ANGLE = 2.39996;
const ARRIVE_DEPTH = 0.5;

const settle = (x) => expoInOut(x) + SETTLE * Math.sin(Math.PI * clamp01((x - 0.5) / 0.5));

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

function footprint(card, margin, push) {
  const s = scaleAt(card.z + push);
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
      const angle = i * GOLDEN_ANGLE + 0.6 * signed(i, 11);
      const ring = 0.62 + 0.3 * hash01(i, 12);
      cards.push({ x: Math.cos(angle) * box.ax * ring, y: Math.sin(angle) * box.ay * ring, z: -depth * (hash01(i, 13) < 0.5 ? 0.1 + 0.2 * hash01(i, 14) : 0.7 + 0.3 * hash01(i, 14)) });
      continue;
    }
    const angle = (2 * Math.PI * i) / n + 0.35 * signed(i, 21) / n + Math.PI / 2;
    const ring = 0.78 + 0.16 * signed(i, 22);
    cards.push({ x: Math.cos(angle) * box.ax * ring, y: Math.sin(angle) * box.ay * ring, z: -depth * (i % 2 ? 0.95 : 0.1) + 0.05 * depth * signed(i, 23) });
  }
  return cards;
}

function crowded(cards, p) {
  return [0, p.push].some((push) => overlapping(cards.map((c) => footprint(c, p.drift, push))));
}

function overlapping(boxes) {
  return boxes.some((a, i) => boxes.slice(i + 1).some((b) => Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.y - b.y) < a.hh + b.hh));
}

function placed(p, box, safe, size) {
  const n = Math.max(1, Math.min(MAX_CARDS, Math.round(p.count)));
  return seeds(p.layout, n, box, Math.max(0, p.depth)).map((seed, i) => {
    const w = size * (0.8 + 0.4 * hash01(i, 31));
    const card = { ...seed, w, h: w * CARD_RATIO, i };
    clearOf(card, p, safe);
    if (p.contain) {
      fitInside(card, p, safe, box);
    }
    return { ...card, phase: hash01(i, 41) * 2 * Math.PI, tilt: signed(i, 42) };
  });
}

function separate(a, b, p, push) {
  const fa = footprint(a, p.drift, push);
  const fb = footprint(b, p.drift, push);
  const overX = fa.hw + fb.hw - Math.abs(fa.x - fb.x);
  const overY = fa.hh + fb.hh - Math.abs(fa.y - fb.y);
  if (overX <= 0 || overY <= 0) {
    return;
  }
  const alongX = overX * fb.hh < overY * fb.hw;
  const sign = (alongX ? fa.x - fb.x : fa.y - fb.y) >= 0 ? 1 : -1;
  const step = (alongX ? overX : overY) / 2 + 1e-3;
  const axis = alongX ? 'x' : 'y';
  a[axis] += (sign * step) / scaleAt(a.z + push);
  b[axis] -= (sign * step) / scaleAt(b.z + push);
}

function relax(cards, p, safe, box) {
  for (let round = 0; round < RELAX_ROUNDS && crowded(cards, p); round++) {
    for (const push of [0, p.push]) {
      cards.forEach((a, i) => cards.slice(i + 1).forEach((b) => separate(a, b, p, push)));
    }
    for (const card of cards) {
      clearOf(card, p, safe);
      if (p.contain) {
        fitInside(card, p, safe, box);
      }
    }
  }
  return cards;
}

function floatLayout(p, width, height) {
  const box = frameBox(width, height);
  const safe = safeBox(p, box);
  let size = p.cardSize;
  let cards = relax(placed(p, box, safe, size), p, safe, box);
  for (let step = 0; step < PUSH_STEPS && crowded(cards, p); step++) {
    size *= SHRINK;
    cards = relax(placed(p, box, safe, size), p, safe, box);
  }
  return cards;
}

function clearOf(card, p, safe) {
  for (let step = 0; step < PUSH_STEPS && overlaps(footprint(card, p.drift, 0), safe); step++) {
    const away = card.x === 0 && card.y === 0 ? { x: 0, y: 1e-3 } : card;
    card.x = away.x * PUSH_OUT;
    card.y = away.y * PUSH_OUT;
  }
}

function sidestep(card, p, safe, box) {
  const near = footprint(card, p.drift, 0);
  if (!overlaps(near, safe)) {
    return;
  }
  const far = footprint(card, p.drift, p.push);
  const side = card.x < 0 ? -1 : 1;
  const x = side * (safe.hw + near.hw + 1e-3) / scaleAt(card.z);
  if (Math.abs(x) * scaleAt(card.z + p.push) + far.hw <= box.ax) {
    card.x = x;
  }
}

function fitInside(card, p, safe, box) {
  for (let step = 0; step < PUSH_STEPS; step++) {
    const f = footprint(card, p.drift, p.push);
    const s = scaleAt(card.z + p.push);
    const overX = Math.abs(f.x) + f.hw - box.ax;
    const overY = Math.abs(f.y) + f.hh - box.ay;
    if (overX <= 0 && overY <= 0 && !overlaps(footprint(card, p.drift, 0), safe)) {
      return;
    }
    card.x -= overX > 0 ? Math.sign(card.x) * overX / s : 0;
    card.y -= overY > 0 ? Math.sign(card.y) * overY / s : 0;
    sidestep(card, p, safe, box);
    if (overlaps(footprint(card, p.drift, 0), safe) || overX > f.hw || overY > f.hh) {
      card.w *= SHRINK;
      card.h *= SHRINK;
      clearOf(card, p, safe);
    }
  }
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
    rx: 2 * p.tilt * wobble(5.3),
    ry: 3 * p.tilt * wobble(6.7)
  };
}

const titleEnd = (words, p) => p.titleAt + Math.max(0, words - 1) * WORD_GAP + WORD_IN;

function entranceAt(card, n, p, t, length, start) {
  if (!p.entrance) {
    return { in: 1, out: 0 };
  }
  const at = start + p.enterAt + card.i * p.stagger;
  const leave = p.leave ? length - EXIT - (n - 1 - card.i) * p.stagger * 0.4 : Infinity;
  return { in: span(t, at, ENTER), out: span(t, leave - 0.05, EXIT) };
}

function cardFrame(card, n, p, t, length, start, push) {
  const d = drift(card, p, t, length);
  const e = entranceAt(card, n, p, t, length, start);
  const arrive = expoInOut(e.in);
  const leave = expoInOut(e.out);
  const away = (1 - arrive) + leave;
  const z = card.z + d.z - away * ARRIVE_DEPTH + push;
  const sight = scaleAt(card.z + d.z + push) / scaleAt(z);
  const visible = smooth(clamp01(e.in * 1.6)) * (1 - smooth(e.out));
  const depthShare = p.depth > 0 ? clamp01(-z / (p.depth + 0.4)) : 0;
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
    blur: p.focusBlur * Math.max(0, depthShare - 0.15),
    dim: p.dim * depthShare
  };
}

function wordFrames(words, p, t, length) {
  return words.map((_, i) => {
    const at = p.titleAt + i * WORD_GAP;
    const e = wordIn(t, at);
    const out = p.leave ? expoInOut(span(t, length - EXIT - 0.2 + i * 0.04, EXIT * 0.8)) : 0;
    return { y: e.rise - 0.1 * out, blur: p.titleBlur * (1 - e.progress + out), opacity: e.opacity * (1 - smooth(out)) };
  });
}

function floatFrame(layout, p, t, length) {
  const words = String(p.title || '').trim().split(/\s+/).filter(Boolean);
  const push = p.push * Math.pow(Math.sin((Math.PI * clamp01(t / length))), 2);
  const sub = p.leave ? 1 - smooth(span(t, length - EXIT - 0.2, EXIT * 0.8)) : 1;
  return {
    cards: layout.map((card) => cardFrame(card, layout.length, p, t, length, titleEnd(words.length, p), push)),
    words: wordFrames(words, p, t, length),
    subtitle: smooth(span(t, p.titleAt + 0.35 + words.length * WORD_GAP, 0.8)) * sub,
    camera: push
  };
}
`;
