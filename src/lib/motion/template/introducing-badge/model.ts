import { WORD_ENTRANCE } from '../word-entrance';

export const BADGE_MODEL = String.raw`
${WORD_ENTRANCE}
const ARC_IN = 3.2;
const ARC_FADE = 1.8;
const ARC_EASED_SHARE = 0.8;
const BADGE_IN = 1;
const BADGE_FROM = 0.9;
const BADGE_FADE = 0.4;
const SHINE_AFTER = 0.7;
const SHINE_LENGTH = 1.4;
const EXIT = 1.2;
const EXIT_RISE = 0.08;
const EXIT_GAP = 0.05;

const bell = (x) => Math.sin(Math.PI * clamp01(x));

const leaving = (p, t, length, order) => (p.leave ? smooth(span(t, length - EXIT - 0.2 + order * EXIT_GAP, EXIT)) : 0);

function arcFrame(p, t, length) {
  const out = p.leave ? expoInOut(span(t, length - EXIT - 0.4, EXIT + 0.4)) : 0;
  const lift = p.arcRise * (ARC_EASED_SHARE * expoInOut(span(t, 0, ARC_IN)) + (1 - ARC_EASED_SHARE) * (t / length));
  return { lift: lift * (1 - out), opacity: smooth(span(t, 0, ARC_FADE)) * (1 - out) };
}

function wordsFrame(count, at, p, t, length, order) {
  return Array.from({ length: count }, (_, i) => {
    const e = wordIn(t, at + i * WORD_GAP);
    const out = leaving(p, t, length, order + i);
    return { y: e.rise - EXIT_RISE * out, opacity: e.opacity * (1 - out) };
  });
}

function badgeOnly(p, t, length, order) {
  const grow = expoInOut(span(t, p.badgeAt, BADGE_IN));
  const out = leaving(p, t, length, order);
  const sweep = span(t, p.badgeAt + SHINE_AFTER, SHINE_LENGTH);
  return {
    scale: BADGE_FROM + (1 - BADGE_FROM) * grow,
    opacity: smooth(span(t, p.badgeAt, BADGE_FADE)) * (1 - out),
    shine: expoInOut(sweep),
    shineOpacity: bell(sweep) * (1 - out)
  };
}

function badgeFrame(p, t, length, intro, name) {
  return {
    arc: arcFrame(p, t, length),
    intro: wordsFrame(intro, p.introAt, p, t, length, 0),
    badge: badgeOnly(p, t, length, intro),
    name: wordsFrame(name, p.nameAt, p, t, length, intro + 1)
  };
}
`;
