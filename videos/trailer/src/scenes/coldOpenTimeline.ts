import { ENTER_PAUSE } from "../timing";

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

const KEY_GAPS = [2, 1, 2, 2, 1, 3, 1, 2, 2, 1, 2, 3];
const TYPO_NOTICE = 6;
const BACKSPACE_GAP = 3;

const keystrokes = (keys: string, start: number): Keystroke[] => {
  let at = start;
  let previous = "";

  return [...keys].map((key, i) => {
    const stroke = key === BACKSPACE ? Stroke.Backspace : Stroke.Char;
    const noticed = stroke === Stroke.Backspace && previous !== BACKSPACE;

    at += i === 0 ? 0 : noticed ? TYPO_NOTICE : stroke === Stroke.Backspace ? BACKSPACE_GAP : KEY_GAPS[i % KEY_GAPS.length];
    previous = key;

    return { at, key, stroke };
  });
};

type BeatSpec = {
  keys: string;
  reply: string;
  kind: Reply;
  work: number;
  focus: Focus;
  hold: number;
  lead: number;
};

export type Beat = BeatSpec & {
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
const LEAD_IN = 6;
const SIGH = 20;
const REVEAL_LAG = 4;
const CHANGE_DURATION = 24;

export const LIFT = 5;
export const ZOOM = 20;
export const BROWSER_LEAD = 8;

const REVEAL: Record<Focus, number> = {
  [Focus.Prompt]: 0,
  [Focus.Page]: 2 * ZOOM,
  [Focus.Stack]: LIFT + CHANGE_DURATION,
  [Focus.Limit]: 0,
};

export const applyKeys = (keys: string) =>
  [...keys].reduce((text, key) => (key === BACKSPACE ? text.slice(0, -1) : text + key), "");

const SPECS: BeatSpec[] = [
  { keys: "build a perfect landing page. first try 😎", reply: "Done! Your website is ready ✨", kind: Reply.Done, work: 40, focus: Focus.Page, hold: 14, lead: LEAD_IN },
  { keys: "move the nabv⌫⌫vbar to the left", reply: "Done! Navbar moved.", kind: Reply.Done, work: 14, focus: Focus.Stack, hold: 16, lead: LEAD_IN },
  { keys: "no no, I meant to the CENTRE⌫⌫ER", reply: "Done! Navbar centered.", kind: Reply.Done, work: 14, focus: Focus.Stack, hold: 16, lead: LEAD_IN },
  { keys: "fix the title, use the rigth⌫⌫ht color!", reply: "Done! Title color fixed.", kind: Reply.Done, work: 14, focus: Focus.Stack, hold: 20, lead: LEAD_IN },
  { keys: "NO!! blakc⌫⌫ck, like EVERY other title!!!", reply: "You've reached your usage limit.\nTry again in 5 hours.", kind: Reply.Limit, work: 20, focus: Focus.Limit, hold: 66, lead: SIGH },
];

const build = (specs: BeatSpec[]): Beat[] => {
  let cursor = OPENING;

  return specs.map((spec) => {
    const start = cursor;
    const typeStart = start + spec.lead;
    const strokes = keystrokes(spec.keys, typeStart);
    const submit = strokes[strokes.length - 1].at + ENTER_PAUSE;
    const replyAt = submit + spec.work;
    const frontAt = replyAt + REVEAL_LAG;
    const changeAt = frontAt + LIFT;
    const end = frontAt + REVEAL[spec.focus] + spec.hold;

    cursor = end;

    return { ...spec, prompt: applyKeys(spec.keys), strokes, start, typeStart, submit, replyAt, frontAt, changeAt, end };
  });
};

export const BEATS = build(SPECS);

export const [BUILD, NAV_LEFT, NAV_CENTER, TITLE_FIX, LIMIT] = BEATS;

export const NAV_CHANGE = CHANGE_DURATION;

export const COLD_OPEN_FRAMES = LIMIT.end;

export const BROWSER_OPENS = BUILD.replyAt - BROWSER_LEAD;

export const CAMERA_KEYS = [
  { at: 0, focus: Focus.Prompt },
  { at: BUILD.frontAt, focus: Focus.Page, move: ZOOM },
  { at: BUILD.frontAt + ZOOM + BUILD.hold, focus: Focus.Stack, move: ZOOM },
  { at: LIMIT.start, focus: Focus.Limit, move: ZOOM },
];

const swaps = (beat: Beat) => (beat.kind === Reply.Limit ? [{ at: beat.start, front: Front.Terminal }] : [
  { at: beat.start, front: Front.Terminal },
  { at: beat.frontAt, front: Front.Browser },
]);

export const SWAPS = BEATS.slice(1).flatMap(swaps);

export const FRONT_KEYS = [{ at: -LIFT, front: Front.Terminal }, { at: BROWSER_OPENS, front: Front.Browser }, ...SWAPS];
