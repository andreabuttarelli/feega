import { WORD_ENTRANCE } from '../word-entrance';

export const STACK_MODEL = String.raw`
${WORD_ENTRANCE}
const LINE = 1.1;
const MOVE = 1.2;
const SHRINK = 0.16;
const OFFSETS = [0.06, -0.08, 0.1, -0.03, 0.07, -0.05];
const ENTRY_GAP = 0.04;
const MAX_WIDTH = 0.5;
const WORD_LAG = 0.55;
const WORD_STAGGER = 0.12;
const WORD_SPACE = 0.18;
const EXIT = 1.2;
const EXIT_PAD = 0.05;
const WORD_EXIT = 0.6;
const WORD_LIFT = 0.12;
const ZOOM = 0.08;
const MAX_CARDS = 12;

const wordsOf = (raw) => String(raw || '').split('/').map((s) => s.trim()).filter(Boolean).slice(0, 2);

function stackLayout(p, width, height) {
  const heroH = Math.min(p.cardHeight * height, (MAX_WIDTH * width) / p.cardAspect);
  const heroW = heroH * p.cardAspect;
  const olderW = heroW * (1 - SHRINK);
  return { heroH, heroW, heroX: (width - heroW) / 2, heroY: (height - heroH) / 2, pitch: olderW * (1 - p.overlap), size: Math.min(p.fontSize * Math.min(width, height), ((height - heroH) / 2) / (LINE + WORD_SPACE)) };
}

function stackFrame(p, t, length, width, height) {
  const n = Math.max(1, Math.min(MAX_CARDS, Math.round(p.cards)));
  const L = stackLayout(p, width, height);
  const arrive = (i) => p.lead + i * p.beat;
  const moved = (i) => expoInOut(span(t, arrive(i), MOVE));
  const out = expoInOut(span(t, length - EXIT_PAD - EXIT, EXIT));
  const away = out * (L.heroX + L.heroW + ENTRY_GAP * width);
  const cards = Array.from({ length: n }, (_, i) => {
    let age = 0;
    for (let j = i + 1; j < n; j++) {
      age += moved(j);
    }
    const settled = Math.min(1, age);
    const scale = 1 - SHRINK * settled;
    const w = L.heroW * scale;
    const h = L.heroH * scale;
    const start = -w - ENTRY_GAP * width;
    const x = start + (L.heroX - start) * moved(i) - age * L.pitch - away;
    const y = height / 2 - h / 2 + OFFSETS[i % OFFSETS.length] * L.heroH * settled;
    const zoom = 1 + ZOOM * (1 - smooth(span(t, arrive(i), length - arrive(i))));
    return { index: i, media: i, x, y, w, h, opacity: 1, zoom };
  });
  const landed = arrive(n - 1) + MOVE * WORD_LAG;
  const fade = smooth(span(t, length - EXIT_PAD - EXIT - WORD_EXIT * 0.5, WORD_EXIT));
  const centre = L.heroX + L.heroW / 2;
  const words = wordsOf(p.words).map((text, k) => {
    const word = wordIn(t, landed + k * WORD_STAGGER);
    const y = k === 0 ? L.heroY - L.size * (LINE + WORD_SPACE) : L.heroY + L.heroH + L.size * WORD_SPACE;
    return { text, x: centre, y, size: L.size, opacity: word.opacity * (1 - fade), rise: word.rise - WORD_LIFT * fade };
  });
  return { cards, words };
}
`;
