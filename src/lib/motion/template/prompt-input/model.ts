export const PROMPT_MODEL = String.raw`
const PUNCTUATION = '.,!?;:';
const WRONG_KEYS = 'qwertyuiopasdfghjklzxcvbnm';
const TYPO_PAUSE = 0.34;
const BACKSPACE = 0.075;
const RESUME = 0.16;
const HOLD_BEFORE_PRESS = 0.95;
const PRESS_TO_SUBMIT = 0.16;
const THINKING = 2.3;
const CLEAR = 0.45;
const RETURN = 0.6;
const TAIL = 0.9;
const BLINK_PERIOD = 1.05;
const LOOP_SETTLE = 0.5;
const SETTLE = 0.012;

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

const wrongKey = (i) => WRONG_KEYS[Math.floor(hash01(i, 9) * WRONG_KEYS.length)];

const typoStart = (text, share) => {
  const target = Math.round(clamp01(share) * text.length);
  const starts = [];
  for (let i = 1; i < text.length - 3; i++) {
    if (text[i - 1] === ' ' && /[a-z]{3}/i.test(text.slice(i, i + 3))) {
      starts.push(i + 2);
    }
  }
  return starts.length ? starts.reduce((best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best)) : -1;
};

const keyGap = (text, i, speed) => {
  const before = text[i - 1] || '';
  const rhythm = 0.55 + 0.9 * hash01(i, 1);
  const breath = before === ' ' ? 1.35 : 1;
  const stop = PUNCTUATION.includes(before) ? 0.3 : 0;
  return rhythm * breath / speed + stop;
};

function keystrokes(text, speed, typo, typoAt) {
  const events = [];
  const slip = typo ? typoStart(text, typoAt) : -1;
  let at = 0;
  for (let i = 0; i < text.length; i++) {
    at += i ? keyGap(text, i, speed) : 0;
    if (i === slip) {
      const wrong = wrongKey(i) + wrongKey(i + 1);
      events.push({ at, shown: text.slice(0, i) + wrong[0] });
      at += keyGap(text, i + 1, speed);
      events.push({ at, shown: text.slice(0, i) + wrong });
      at += TYPO_PAUSE;
      events.push({ at, shown: text.slice(0, i) + wrong[0] });
      at += BACKSPACE;
      events.push({ at, shown: text.slice(0, i) });
      at += RESUME;
    }
    events.push({ at, shown: text.slice(0, i + 1) });
  }
  return events;
}

const SUBMITS = {
  thinking: { press: true, after: THINKING },
  clear: { press: true, after: CLEAR },
  hold: { press: false, after: HOLD_BEFORE_PRESS }
};

function promptPlan(p, length) {
  const submit = SUBMITS[p.submit] || SUBMITS.thinking;
  const keys = keystrokes(p.text, Math.max(1, p.speed), p.typo, p.typoAt);
  const typing = keys.length ? keys[keys.length - 1].at : 0;
  const typeStart = Math.max(0, p.startDelay);
  const pressAt = typeStart + typing + HOLD_BEFORE_PRESS;
  const submitAt = pressAt + PRESS_TO_SUBMIT;
  const returnAt = submitAt + submit.after;
  const natural = returnAt + RETURN + TAIL;
  const k = p.repeat && natural > length ? length / natural : 1;
  return {
    k,
    length,
    repeat: p.repeat,
    style: p.submit in SUBMITS ? p.submit : 'thinking',
    press: submit.press,
    keys: keys.map((e) => ({ at: (typeStart + e.at) * k, shown: e.shown })),
    typeStart: typeStart * k,
    typeEnd: (typeStart + typing) * k,
    pressAt: pressAt * k,
    submitAt: submitAt * k,
    returnAt: p.repeat ? returnAt * k : Infinity
  };
}

function shownAt(plan, t) {
  let shown = '';
  for (const e of plan.keys) {
    if (e.at > t) {
      break;
    }
    shown = e.shown;
  }
  return shown;
}

function blinkAt(plan, t) {
  const wave = 0.5 + 0.5 * clamp01(Math.cos((2 * Math.PI * t) / BLINK_PERIOD) * 3 + 0.5);
  const typing = span(t, plan.typeStart - 0.12, 0.08) * (1 - span(t, plan.typeEnd + 0.5, 0.08));
  const fading = plan.repeat ? span(t, plan.length - LOOP_SETTLE, LOOP_SETTLE) : 0;
  const steady = Math.max(typing, smooth(fading));
  return steady + (1 - steady) * wave;
}

function promptFrame(plan, t) {
  const k = plan.k;
  const fade = (at, length) => smooth(span(t, at, length * k));
  const move = (at, length) => expoInOut(span(t, at, length * k));
  const firstKey = plan.keys.length ? plan.keys[0].at : plan.typeStart;
  const thinkingStyle = plan.style === 'thinking';

  const lift = plan.press ? move(plan.submitAt, 0.6) : move(plan.returnAt, RETURN);
  const gone = plan.press ? fade(plan.submitAt, 0.4) : fade(plan.returnAt, RETURN);
  const back = plan.press ? fade(plan.returnAt + 0.1 * k, 0.5) : gone;
  const thinking = thinkingStyle ? fade(plan.submitAt + 0.15 * k, 0.45) * (1 - fade(plan.returnAt - 0.35 * k, 0.45)) : 0;

  const pressDown = plan.press ? smooth(span(t, plan.pressAt - 0.1 * k, 0.14 * k)) : 0;
  const pressUp = plan.press ? settle(span(t, plan.pressAt + 0.04 * k, 0.5 * k)) : 0;
  const armed = fade(firstKey, 0.3) * (1 - (thinkingStyle || !plan.press ? fade(plan.returnAt, 0.4) : fade(plan.submitAt, 0.4)));

  const travel = move(plan.typeEnd + 0.05 * k, (plan.pressAt - plan.typeEnd) / k - 0.15);
  const leave = move(plan.submitAt + 0.35 * k, 0.8);
  const reach = travel * (1 - leave);

  const zoomIn = smooth(span(t, plan.typeStart - 0.3 * k, plan.pressAt - plan.typeStart + 0.3 * k));
  const zoomOut = smooth(span(t, plan.returnAt - 0.2 * k, 1.2 * k));
  const shown = gone >= 1 ? '' : shownAt(plan, t);

  return {
    shown,
    textOpacity: 1 - gone,
    textLift: lift * (1 - back),
    caret: blinkAt(plan, t) * (1 - thinking) * (1 - (plan.press ? gone : 0) * (1 - back)),
    placeholder: Math.max(1 - fade(firstKey, 0.2), back) * (1 - thinking),
    thinking,
    shimmer: (((t - plan.submitAt) / 1.5) % 1 + 1) % 1,
    stop: thinkingStyle ? fade(plan.submitAt, 0.35) * (1 - fade(plan.returnAt - 0.25 * k, 0.4)) : 0,
    armed,
    press: Math.max(-0.2, pressDown - pressUp),
    focus: fade(plan.typeStart - 0.45 * k, 0.45) * (1 - fade(plan.returnAt, 0.7)),
    zoom: zoomIn * (1 - zoomOut),
    cursor: plan.press ? fade(plan.typeEnd - 0.15 * k, 0.4) * (1 - fade(plan.submitAt + 0.5 * k, 0.6)) : 0,
    cursorX: 2.2 - 2.05 * reach + 0.35 * Math.sin(Math.PI * reach),
    cursorY: 2.4 - 2.15 * reach
  };
}
`;
