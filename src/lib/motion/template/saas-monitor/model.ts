import { WORD_ENTRANCE } from '../word-entrance';

export const MOCKUP_MODEL = String.raw`
${WORD_ENTRANCE}
const SCREEN_ASPECT = 9 / 16;
const BEZEL = 0.018;
const CAP_HEIGHT = 0.74;
const ENTER_LIFT = 0.9;
const ENTER_PITCH = 18;
const ENTER_YAW = -14;
const ENTER_SCALE = 0.9;
const VISIBLE_AT = 0.45;
const SWAY_YAW = 7;
const SWAY_LIFT = 0.012;
const MARK_PARALLAX = 0.05;
const TYPE_LEAD = 0.65;
const REVEAL = 0.9;
const READ_PAUSE = 1.1;
const HOVER = 1.3;
const HOVER_EDGE = 0.35;
const CURSOR_LEAD = 0.9;
const SCROLL_PAUSE = 0.4;
const BARS = 1.2;
const MIN_HOLD = 1;

function frameBox(width, height) {
  const short = Math.min(width, height);
  return { ax: width / short / 2, ay: height / short / 2 };
}

const rect = (cx, cy, w, h) => ({ x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 });

function mockupLayout(p, width, height, textEm) {
  const box = frameBox(width, height);
  const screenW = p.monitorSize * 2 * Math.min(box.ax, box.ay * 1.6);
  const bodyW = screenW * (1 + 2 * BEZEL);
  const bodyH = screenW * SCREEN_ASPECT + screenW * 2 * BEZEL;
  const em = (p.watermarkSize / 100) * 2 * box.ay;
  return {
    box,
    screenW,
    bodyW,
    bodyH,
    em,
    monitor: rect(0, p.monitorY, bodyW, bodyH),
    watermark: rect(0, p.watermarkY, textEm * em, CAP_HEIGHT * em)
  };
}

function covered(layout) {
  const { box, monitor, watermark } = layout;
  const seen = { x0: Math.max(watermark.x0, -box.ax), x1: Math.min(watermark.x1, box.ax), y0: Math.max(watermark.y0, -box.ay), y1: Math.min(watermark.y1, box.ay) };
  const area = (r) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
  const hit = { x0: Math.max(seen.x0, monitor.x0), x1: Math.min(seen.x1, monitor.x1), y0: Math.max(seen.y0, monitor.y0), y1: Math.min(seen.y1, monitor.y1) };
  return area(hit) / Math.max(area(seen), 1e-9);
}

const characters = (raw) => Math.max(1, String(raw || '').length);

function beats(p, length) {
  const enterEnd = p.enterAt + p.enterSeconds;
  const exit = p.leave ? p.exitSeconds : 0;
  const leave = length - exit;
  const typeAt = p.enterAt + p.enterSeconds * TYPE_LEAD;
  const parts = [characters(p.headline) / Math.max(1, p.typeSpeed), REVEAL, READ_PAUSE, HOVER, SCROLL_PAUSE, p.scrollSeconds];
  const room = Math.max(0.5, leave - MIN_HOLD - typeAt);
  const fit = Math.min(1, room / parts.reduce((a, b) => a + b, 0));
  const [typing, reveal, read, hover, pause, scroll] = parts.map((d) => d * fit);
  const revealAt = typeAt + typing;
  const hoverAt = revealAt + reveal + read;
  const scrollAt = hoverAt + hover + pause;
  return { enterEnd, leave, exit, typeAt, typing, revealAt, reveal, hoverAt, hover, scrollAt, scroll };
}

function mockupFrame(p, t, length) {
  const b = beats(p, length);
  const arrive = expoInOut(span(t, p.enterAt, p.enterSeconds));
  const depart = p.leave ? expoInOut(span(t, b.leave, b.exit)) : 0;
  const away = Math.max(1 - arrive, depart);
  const swing = Math.pow(Math.sin(Math.PI * clamp01(t / length)), 2);
  const sway = p.drift * (swing - 0.5) * 2;
  const hoverIn = smooth(span(t, b.hoverAt, HOVER_EDGE));
  const hoverOut = smooth(span(t, b.hoverAt + b.hover - HOVER_EDGE, HOVER_EDGE));
  return {
    pose: {
      lift: ENTER_LIFT * away,
      yaw: p.tiltYaw + ENTER_YAW * away + SWAY_YAW * sway,
      pitch: p.tiltPitch + ENTER_PITCH * away,
      scale: 1 - (1 - ENTER_SCALE) * away,
      opacity: smooth(clamp01((1 - away) / VISIBLE_AT))
    },
    sway,
    float: -SWAY_LIFT * p.drift * swing,
    markShift: -MARK_PARALLAX * sway,
    typed: span(t, b.typeAt, b.typing),
    typing: t >= b.typeAt && t < b.revealAt + REVEAL,
    reveal: expoInOut(span(t, b.revealAt, b.reveal)),
    hover: hoverIn * (1 - hoverOut),
    cursor: expoInOut(span(t, b.hoverAt - CURSOR_LEAD, CURSOR_LEAD)) * (1 - smooth(span(t, b.scrollAt, b.scroll * 0.5))),
    scroll: p.scroll ? expoInOut(span(t, b.scrollAt, b.scroll)) : 0,
    bars: p.scroll ? expoInOut(span(t, b.scrollAt + b.scroll * 0.55, BARS)) : 0
  };
}
`;
