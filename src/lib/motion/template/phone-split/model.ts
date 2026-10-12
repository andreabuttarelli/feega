import { WORD_ENTRANCE } from '../word-entrance';
import { SPLIT_LINE } from '../split-line';

export const PHONE_MODEL = String.raw`
${WORD_ENTRANCE}
${SPLIT_LINE}
const PHONE_ASPECT = 0.486;
const BELOW_MARGIN = 0.6;
const ARRIVE_SHARE = 0.62;
const WORDS_OUT = 0.6;
const WORDS_OUT_LIFT = 0.2;

function phoneLayout(p, m) {
  const phoneH = p.phoneHeight;
  const phoneW = phoneH * PHONE_ASPECT;
  const rowWidth = m.leftW + m.rightW + phoneW + 2 * p.gap;
  const rowFit = Math.min(1, (m.frameW * SAFE) / rowWidth, (m.frameH * SAFE) / phoneH);
  const axis = chooseAxis(p, rowFit, m);
  const columnFit = Math.min(1, (m.frameW * SAFE) / Math.max(m.leftW, m.rightW, phoneW), (m.frameH * SAFE) / (2 + phoneH + 2 * p.gap));
  const fit = axis === 'row' ? rowFit : columnFit;
  const cx = axis === 'row' ? (m.leftW - m.rightW) / 2 : 0;
  return { axis, fit, phoneW, phoneH, gap: p.gap, cx, riseFrom: m.frameH / fit / 2 + phoneH / 2 + BELOW_MARGIN };
}

function phoneTimes(p, length) {
  const dropAt = length - p.dropSeconds;
  return { riseAt: p.riseAt, titleAt: p.riseAt + p.riseSeconds * ARRIVE_SHARE + p.titleDelay, outAt: dropAt - WORDS_OUT * 0.5, dropAt };
}

function arrival(p, times, t) {
  const rose = expoInOut(span(t, times.riseAt, p.riseSeconds));
  const dropped = p.leave ? expoInOut(span(t, times.dropAt, p.dropSeconds)) : 0;
  return Math.max(0, rose - dropped);
}

function hugPhone(layout) {
  const hug = layout.phoneW / 2 + layout.gap;
  if (layout.axis === 'row') {
    return { left: { x: layout.cx - hug, y: 0 }, right: { x: layout.cx + hug, y: 0 } };
  }
  const reach = layout.phoneH / 2 + layout.gap + 0.5;
  return { left: { x: 0, y: -reach }, right: { x: 0, y: reach } };
}

function phoneWords(count, p, times, t) {
  const out = p.leave ? smooth(span(t, times.outAt, WORDS_OUT * 0.85)) : 0;
  return Array.from({ length: count }, (_, i) => {
    const look = wordIn(t, times.titleAt + i * WORD_GAP);
    return { rise: look.rise - WORDS_OUT_LIFT * out, opacity: look.opacity * (1 - out) };
  });
}

function phoneFrame(layout, p, t, length, words) {
  const times = phoneTimes(p, length);
  const e = arrival(p, times, t);
  return {
    arrived: e,
    phone: { x: layout.cx, y: layout.riseFrom * (1 - e), tilt: p.tilt ? p.tiltDegrees * (1 - e) : 0 },
    ...hugPhone(layout),
    words: phoneWords(words, p, times, t),
    times
  };
}
`;
