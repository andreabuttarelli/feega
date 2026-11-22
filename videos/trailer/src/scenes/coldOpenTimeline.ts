
export enum Focus {
  Prompt = "prompt",
  Page = "page",
  Stack = "stack",
  Limit = "limit",
}

export enum Front {
  Terminal = "terminal",
  Browser = "browser",
}

export enum Reply {
  Done = "done",
  Limit = "limit",
}

export const BACKSPACE = "⌫";

export enum Stroke {
  Char = "char",
  Backspace = "backspace",
}

export type Keystroke = { at: number; key: string; stroke: Stroke };

export enum Typing {
  Human = "human",
  Burst = "burst",
}

export type Pace = {
  typing: Typing;
  speed: number;
  lead: number;
  enter: number;
  think: number;
  lag: number;
  swap: number;
  change: number;
  hold: number;
};

const ACCELERATION: Pace[] = [
  { typing: Typing.Human, speed: 1.4, lead: 10, enter: 14, think: 56, lag: 6, swap: 5, change: 26, hold: 40 },
  { typing: Typing.Human, speed: 1, lead: 8, enter: 12, think: 26, lag: 5, swap: 5, change: 18, hold: 34 },
  { typing: Typing.Human, speed: 0.55, lead: 5, enter: 10, think: 10, lag: 4, swap: 3, change: 8, hold: 26 },
  { typing: Typing.Burst, speed: 4, lead: 3, enter: 12, think: 3, lag: 4, swap: 0, change: 0, hold: 18 },
  { typing: Typing.Burst, speed: 3, lead: 3, enter: 10, think: 0, lag: 0, swap: 0, change: 0, hold: 60 },
];

const KEY_GAPS = [2, 1, 2, 2, 1, 3, 1, 2, 2, 1, 2, 3];
const TYPO_NOTICE = 6;
const BACKSPACE_GAP = 3;

const humanGap = (key: string, previous: string, i: number) => {
  if (i === 0) {
    return 0;
  }

  if (key !== BACKSPACE) {
    return KEY_GAPS[i % KEY_GAPS.length];
  }

  return previous === BACKSPACE ? BACKSPACE_GAP : TYPO_NOTICE;
};

const humanKeys = (keys: string[], start: number, speed: number): Keystroke[] => {
  let elapsed = 0;

  return keys.map((key, i) => {
    elapsed += humanGap(key, keys[i - 1] ?? "", i) * speed;

    return { at: start + Math.floor(elapsed), key, stroke: key === BACKSPACE ? Stroke.Backspace : Stroke.Char };
  });
};

const burstKeys = (keys: string[], start: number, frames: number): Keystroke[] =>
  keys.map((key, i) => ({ at: start + Math.floor(((i + 1) * frames) / keys.length), key, stroke: key === BACKSPACE ? Stroke.Backspace : Stroke.Char }));

const keystrokes = (keys: string, start: number, pace: Pace) =>
  pace.typing === Typing.Burst ? burstKeys([...keys], start, pace.speed) : humanKeys([...keys], start, pace.speed);

type BeatSpec = {
  keys: string;
  reply: string;
  kind: Reply;
  focus: Focus;
};

export type Beat = BeatSpec & Pace & {
  prompt: string;
  strokes: Keystroke[];
  start: number;
  typeStart: number;
  submit: number;
  replyAt: number;
  frontAt: number;
  changeAt: number;
  end: number;
};

const OPENING = 16;

export const LIFT = ACCELERATION[0].swap;
export const ZOOM = 20;
export const BROWSER_LEAD = 8;

const REVEAL: Record<Focus, (pace: Pace) => number> = {
  [Focus.Prompt]: () => 0,
  [Focus.Page]: () => 2 * ZOOM,
  [Focus.Stack]: (pace) => pace.swap + pace.change,
  [Focus.Limit]: () => 0,
};

export const applyKeys = (keys: string) =>
  [...keys].reduce((text, key) => (key === BACKSPACE ? text.slice(0, -1) : text + key), "");

const SPECS: BeatSpec[] = [
  { keys: "build a perfect landing page. first try 😎", reply: "Done! Your website is ready ✨", kind: Reply.Done, focus: Focus.Page },
  { keys: "move the nabv⌫⌫vbar to the left", reply: "Done! Navbar moved.", kind: Reply.Done, focus: Focus.Stack },
  { keys: "no no, I meant to the CENTRE⌫⌫ER", reply: "Done! Navbar centered.", kind: Reply.Done, focus: Focus.Stack },
  { keys: "fix the title, use the rigth⌫⌫ht color!", reply: "Done! Title color fixed.", kind: Reply.Done, focus: Focus.Stack },
  { keys: "NO!! blakc⌫⌫ck, like EVERY other title!!!", reply: "You're out of credits.\nUpgrade to Pro ($199/mo) or wait 5 hours.", kind: Reply.Limit, focus: Focus.Limit },
];

const build = (specs: BeatSpec[]): Beat[] => {
  let cursor = OPENING;

  return specs.map((spec, i) => {
    const pace = ACCELERATION[i];
    const start = cursor;
    const typeStart = start + pace.lead;
    const strokes = keystrokes(spec.keys, typeStart, pace);
    const submit = strokes[strokes.length - 1].at + pace.enter;
    const replyAt = submit + pace.think;
    const frontAt = replyAt + pace.lag;
    const changeAt = frontAt + pace.swap;
    const end = frontAt + REVEAL[spec.focus](pace) + pace.hold;

    cursor = end;

    return { ...spec, ...pace, prompt: applyKeys(spec.keys), strokes, start, typeStart, submit, replyAt, frontAt, changeAt, end };
  });
};

export const BEATS = build(SPECS);

export const [BUILD, NAV_LEFT, NAV_CENTER, TITLE_FIX, LIMIT] = BEATS;

export const COLD_OPEN_FRAMES = LIMIT.end;

export const BROWSER_OPENS = BUILD.replyAt - BROWSER_LEAD;

export const CAMERA_KEYS = [
  { at: 0, focus: Focus.Prompt, move: 0 },
  { at: BUILD.frontAt, focus: Focus.Page, move: ZOOM },
  { at: BUILD.frontAt + ZOOM + BUILD.hold, focus: Focus.Stack, move: ZOOM },
  { at: LIMIT.replyAt, focus: Focus.Limit, move: 0 },
];

const swaps = (beat: Beat) => (beat.kind === Reply.Limit ? [{ at: beat.start, front: Front.Terminal, lift: beat.swap }] : [
  { at: beat.start, front: Front.Terminal, lift: beat.swap },
  { at: beat.frontAt, front: Front.Browser, lift: beat.swap },
]);

export const SWAPS = BEATS.slice(1).flatMap(swaps);

export const FRONT_KEYS = [{ at: -LIFT, front: Front.Terminal, lift: LIFT }, { at: BROWSER_OPENS, front: Front.Browser, lift: LIFT }, ...SWAPS];
