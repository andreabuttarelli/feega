import { WORD_ENTRANCE } from '../word-entrance';

export const CHAT_MODEL = String.raw`
${WORD_ENTRANCE}
const PHONE_ASPECT = 0.486;
const PHONE_SHARE = 0.8;
const SLOT_IN = 0.5;
const MORPH = 0.7;
const TEXT_IN = 0.45;
const LAST_HOLD = 1.2;
const DOTS = 3;
const DOT_RATE = 1.6;
const DOT_LAG = 0.18;
const DOT_FLOOR = 0.3;

function parseMessages(raw) {
  return String(raw || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const cut = line.indexOf('|');
    return cut < 0 ? { name: '', text: line } : { name: line.slice(0, cut).trim(), text: line.slice(cut + 1).trim() };
  });
}

function chatLayout(p, m) {
  const phoneW = Math.min(m.frameW, m.frameH) * PHONE_SHARE * p.phoneSize;
  return { phoneW, phoneH: phoneW / PHONE_ASPECT, top: m.frameH * p.phoneTop };
}

function chatTimes(p, count, length) {
  const outAt = p.leave ? length - p.outSeconds : length;
  const room = outAt - LAST_HOLD - p.startAt - p.typingSeconds;
  const every = count > 1 ? Math.min(p.every, Math.max(0, room) / (count - 1)) : p.every;
  const typingAt = Array.from({ length: count }, (_, i) => p.startAt + i * every);
  const typing = Math.min(p.typingSeconds, every * 0.6 || p.typingSeconds);
  return { typingAt, showAt: typingAt.map((at) => at + typing), outAt };
}

const dotsAt = (t, typing) => Array.from({ length: DOTS }, (_, k) => typing * (DOT_FLOOR + (1 - DOT_FLOOR) * (0.5 + 0.5 * Math.sin(2 * Math.PI * (t * DOT_RATE - k * DOT_LAG)))));

function chatFrame(p, t, length, overflow) {
  const times = chatTimes(p, overflow.length, length);
  const leaving = p.leave ? expoInOut(span(t, times.outAt, p.outSeconds)) : 0;
  const pushed = smooth(span(t, 0, times.outAt));
  const bubbles = overflow.map((_, i) => {
    const slot = expoInOut(span(t, times.typingAt[i], SLOT_IN));
    const morph = expoInOut(span(t, times.showAt[i], MORPH));
    const text = smooth(span(t, times.showAt[i] + MORPH * 0.35, TEXT_IN));
    return { slot, morph, text, dots: dotsAt(t, slot * (1 - morph)) };
  });
  const scroll = overflow.reduce((sum, extra, i) => sum + extra * bubbles[i].slot, 0);
  return { camera: 1 + p.push * pushed * (1 - leaving), fade: 1 - leaving, scroll, bubbles };
}
`;
