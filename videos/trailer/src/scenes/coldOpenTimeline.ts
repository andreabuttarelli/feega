import { CAMERA_MOVE, ENTER_PAUSE, FRAMES_PER_CHAR } from "../timing";

export enum Focus {
  Prompt = "prompt",
  Page = "page",
  Navbar = "navbar",
  Limit = "limit",
}

export enum Reply {
  Done = "done",
  Limit = "limit",
}

export const BACKSPACE = "⌫";

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
  start: number;
  typeStart: number;
  submit: number;
  replyAt: number;
  cameraAt: number;
  changeAt: number;
  end: number;
};

const OPENING = 22;
const LEAD_IN = 8;
const SIGH = 42;
const REVEAL_LAG = 6;
const CHANGE_DURATION = 30;

export const applyKeys = (keys: string) =>
  [...keys].reduce((text, key) => (key === BACKSPACE ? text.slice(0, -1) : text + key), "");

const SPECS: BeatSpec[] = [
  { keys: "build a perfect landing page. first try 😎", reply: "Done! Your website is ready ✨", kind: Reply.Done, work: 48, focus: Focus.Page, hold: 50, lead: LEAD_IN },
  { keys: "move the nabv⌫⌫vbar to the left", reply: "Done! Navbar moved.", kind: Reply.Done, work: 18, focus: Focus.Navbar, hold: 34, lead: LEAD_IN },
  { keys: "no no, I meant to the CENTRE⌫⌫ER", reply: "Done! Navbar centered.", kind: Reply.Done, work: 18, focus: Focus.Navbar, hold: 34, lead: LEAD_IN },
  { keys: "fix the title, use the rigth⌫⌫ht color!", reply: "Done! Title color fixed.", kind: Reply.Done, work: 18, focus: Focus.Page, hold: 38, lead: LEAD_IN },
  { keys: "NO!! blakc⌫⌫ck, like EVERY other title!!!", reply: "You've reached your usage limit.\nTry again in 5 hours.", kind: Reply.Limit, work: 24, focus: Focus.Limit, hold: 80, lead: SIGH },
];

const build = (specs: BeatSpec[]): Beat[] => {
  let cursor = OPENING;

  return specs.map((spec) => {
    const start = cursor;
    const typeStart = start + spec.lead;
    const submit = typeStart + Math.round([...spec.keys].length * FRAMES_PER_CHAR) + ENTER_PAUSE;
    const replyAt = submit + spec.work;
    const cameraAt = replyAt + REVEAL_LAG;
    const changeAt = cameraAt + CAMERA_MOVE;
    const end = changeAt + CHANGE_DURATION + spec.hold;

    cursor = end;

    return { ...spec, prompt: applyKeys(spec.keys), start, typeStart, submit, replyAt, cameraAt, changeAt, end };
  });
};

export const BEATS = build(SPECS);

export const [BUILD, NAV_LEFT, NAV_CENTER, TITLE_FIX, LIMIT] = BEATS;

export const NAV_CHANGE = CHANGE_DURATION;

export const COLD_OPEN_FRAMES = LIMIT.end;

export const CAMERA_KEYS = BEATS.flatMap((beat) => [
  { at: beat.start - CAMERA_MOVE, focus: Focus.Prompt },
  { at: beat.cameraAt, focus: beat.focus },
]);
