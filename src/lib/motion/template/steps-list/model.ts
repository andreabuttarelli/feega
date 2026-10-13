import { WORD_ENTRANCE } from '../word-entrance';

export const STEPS_MODEL = String.raw`
${WORD_ENTRANCE}
const LINE_AT = 0.35;
const FIRST_STEP = 1;
const LINE_IN = 1.3;
const WORKING_AT = 0.6;
const HANDOVER = 0.7;
const OUT = 0.7;
const OUT_LEAD = 0.25;
const SHIMMER_PERIOD = 1.8;
const SHIMMER_WIDTH = 0.2;
const SHIMMER_REACH = 0.6;

function parseSteps(raw) {
  return String(raw || '')
    .split(/[;\n]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, ...rest] = line.split(' - ');
      return { label: label.trim(), detail: rest.join(' - ').trim() };
    });
}

const stepAt = (p, i) => p.delay + FIRST_STEP + p.pace * i;

function stepsFrame(p, t, length, count) {
  const fade = 1 - smooth(span(t, length - OUT_LEAD - OUT, OUT));
  const heading = wordIn(t, p.delay);
  const steps = Array.from({ length: count }, (_, i) => {
    const w = wordIn(t, stepAt(p, i));
    const next = i + 1 < count ? smooth(span(t, stepAt(p, i + 1), HANDOVER)) : 0;
    return { opacity: w.opacity * fade, rise: w.rise, current: smooth(span(t, stepAt(p, i), HANDOVER)) * (1 - next) };
  });
  return {
    heading: { opacity: heading.opacity * fade, rise: heading.rise },
    line: expoInOut(span(t, p.delay + LINE_AT, LINE_IN)) * fade,
    steps,
    working: smooth(span(t, p.delay + WORKING_AT, WORD_IN * 0.5)) * fade
  };
}

function shimmer(p, t, letters) {
  const phase = (((t - p.delay) / SHIMMER_PERIOD) % 1 + 1) % 1;
  const centre = -SHIMMER_REACH + phase * (1 + 2 * SHIMMER_REACH);
  return Array.from({ length: letters }, (_, k) => {
    const x = letters > 1 ? k / (letters - 1) : 0.5;
    return Math.exp(-Math.pow((x - centre) / SHIMMER_WIDTH, 2));
  });
}
`;
