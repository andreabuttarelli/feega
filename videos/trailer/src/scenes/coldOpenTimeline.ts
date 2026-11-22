import { CAMERA_MOVE, ENTER_PAUSE, FRAMES_PER_CHAR } from "../timing";

export enum Focus {
  Prompt = "prompt",
  Wide = "wide",
  Navbar = "navbar",
  Title = "title",
  Limit = "limit",
}

export enum Reply {
  Done = "done",
  Limit = "limit",
}

type BeatSpec = {
  prompt: string;
  reply: string;
  kind: Reply;
  work: number;
  focus: Focus;
  hold: number;
};

export type Beat = BeatSpec & {
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
const REVEAL_LAG = 6;
const CHANGE_DURATION = 30;

const SPECS: BeatSpec[] = [
  { prompt: "Build the best startup website ever", reply: "Done! Your website is ready.", kind: Reply.Done, work: 60, focus: Focus.Wide, hold: 60 },
  { prompt: "move the navbar to the left", reply: "Done! Navbar moved.", kind: Reply.Done, work: 20, focus: Focus.Navbar, hold: 36 },
  { prompt: "no no, I meant to the center", reply: "Done! Navbar centered.", kind: Reply.Done, work: 20, focus: Focus.Navbar, hold: 36 },
  { prompt: "Fix the title, use the right color", reply: "Done! Title color fixed.", kind: Reply.Done, work: 20, focus: Focus.Title, hold: 36 },
  { prompt: "no! black, like every other title!!!", reply: "You've reached your usage limit.\nTry again in 5 hours.", kind: Reply.Limit, work: 30, focus: Focus.Limit, hold: 90 },
];

const build = (specs: BeatSpec[]): Beat[] => {
  let cursor = OPENING;

  return specs.map((spec) => {
    const start = cursor;
    const typeStart = start + LEAD_IN;
    const submit = typeStart + Math.round(spec.prompt.length * FRAMES_PER_CHAR) + ENTER_PAUSE;
    const replyAt = submit + spec.work;
    const cameraAt = replyAt + REVEAL_LAG;
    const changeAt = cameraAt + CAMERA_MOVE;
    const end = changeAt + CHANGE_DURATION + spec.hold;

    cursor = end;

    return { ...spec, start, typeStart, submit, replyAt, cameraAt, changeAt, end };
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
