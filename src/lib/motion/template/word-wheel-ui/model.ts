import { WORD_ENTRANCE } from '../word-entrance';

export const WHEEL_MODEL = String.raw`
${WORD_ENTRANCE}
const ROW_MIN_RATIO = 1.25;
const ROW_SPLIT = 0.5;
const ROW_TEXT_SHARE = 0.86;
const COLUMN_TEXT_SHARE = 0.86;
const ROW_PANEL_TOP = 0.66;
const COLUMN_TEXT_Y = 0.42;
const COLUMN_PANEL_SCALE = 1.5;
const COLUMN_PANEL_LEFT = 0.72;
const PANEL_GAP = 0.05;
const PANEL_ASPECT = 0.82;
const ROW_PITCH = 1.12;
const TEXT_ROWS = 2 * ROW_PITCH + 1;
const VISIBLE_EDGE = 1.3;
const EDGE_FADE = 0.35;
const FIRST_HOLD = 0.7;
const LEAD_DELAY = 0.35;
const WHEEL_DELAY = 0.5;
const EXIT_FADE = 0.6;
const EXIT_RISE = 0.25;
const ENTER_YAW = -16;
const DRIFT_YAW = 2.5;
const VISIBLE_AT = 0.5;

function frameBox(width, height) {
  const short = Math.min(width, height);
  return { ax: width / short / 2, ay: height / short / 2 };
}

const rect = (x0, y0, w, h) => ({ x0, y0, x1: x0 + w, y1: y0 + h, w, h });

function rowLayout(p, box, m) {
  const split = -box.ax + 2 * box.ax * ROW_SPLIT;
  const region = split + box.ax;
  const groupEm = m.leadW + p.gap + m.wordW;
  const em = Math.min((p.textSize / 100) * 2 * box.ay, (region * ROW_TEXT_SHARE) / groupEm);
  const width = groupEm * em;
  const height = TEXT_ROWS * em;
  const text = rect(-box.ax + (region - width) / 2, -height / 2, width, height);
  const panelW = p.panelSize * 2 * box.ax;
  const panel = rect(split + PANEL_GAP, -box.ay * ROW_PANEL_TOP, panelW, panelW * PANEL_ASPECT);
  return { axis: 'row', box, em, text, panel };
}

function columnLayout(p, box, m) {
  const groupEm = m.leadW + p.gap + m.wordW;
  const em = Math.min((p.textSize / 100) * 2 * Math.min(box.ax, box.ay), (2 * box.ax * COLUMN_TEXT_SHARE) / groupEm);
  const width = groupEm * em;
  const height = TEXT_ROWS * em;
  const text = rect(-width / 2, -box.ay * COLUMN_TEXT_Y - height / 2, width, height);
  const panelW = p.panelSize * COLUMN_PANEL_SCALE * 2 * box.ax;
  const panel = rect(-box.ax * COLUMN_PANEL_LEFT, text.y1 + PANEL_GAP, panelW, panelW * PANEL_ASPECT);
  return { axis: 'column', box, em, text, panel };
}

function wheelLayout(p, width, height, m) {
  const box = frameBox(width, height);
  return width / height >= ROW_MIN_RATIO ? rowLayout(p, box, m) : columnLayout(p, box, m);
}

function wheelBeats(p, length, n) {
  const inEnd = p.enterAt + p.enterSeconds;
  const exit = p.leave ? p.exitSeconds : 0;
  const leaveAt = length - exit;
  const spacing = Math.max(p.stepSeconds, (leaveAt - inEnd) / n);
  const rest = spacing - p.stepSeconds;
  const steps = Array.from({ length: n }, (_, k) => inEnd + spacing * k + rest * FIRST_HOLD);
  return { leaveAt, exit, steps };
}

const wrap = (x, n) => x - n * Math.round(x / n);

function textOut(t, b) {
  return b.exit > 0 ? expoInOut(span(t, b.leaveAt, b.exit * EXIT_FADE)) : 0;
}

function wheelFrame(p, t, length, n) {
  const b = wheelBeats(p, length, n);
  const turned = b.steps.reduce((sum, at) => sum + expoInOut(span(t, at, p.stepSeconds)), 0);
  const out = textOut(t, b);
  const leadIn = wordIn(t, p.enterAt + LEAD_DELAY);
  const wheelIn = wordIn(t, p.enterAt + WHEEL_DELAY);
  const words = Array.from({ length: n }, (_, i) => {
    const offset = wrap(i - turned, n);
    const reach = Math.abs(offset);
    return { offset, focus: smooth(clamp01(1 - reach)), opacity: wheelIn.opacity * (1 - out) * smooth(clamp01((VISIBLE_EDGE - reach) / EDGE_FADE)) };
  });
  const arrive = expoInOut(span(t, p.enterAt, p.enterSeconds));
  const depart = p.leave ? expoInOut(span(t, b.leaveAt, b.exit)) : 0;
  const visible = smooth(clamp01(arrive / VISIBLE_AT)) * (1 - smooth(clamp01((depart - VISIBLE_AT) / (1 - VISIBLE_AT))));
  return {
    lead: { opacity: leadIn.opacity * (1 - out), rise: leadIn.rise - EXIT_RISE * out },
    wheel: { rise: wheelIn.rise - EXIT_RISE * out },
    words,
    panel: {
      shift: 1 - arrive + depart,
      yaw: p.yaw + ENTER_YAW * (1 - arrive) + p.drift * DRIFT_YAW * Math.sin((2 * Math.PI * t) / length),
      opacity: visible
    },
    glow: arrive * (1 - depart)
  };
}
`;
