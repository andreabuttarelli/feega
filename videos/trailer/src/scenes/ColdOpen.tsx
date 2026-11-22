import { AbsoluteFill, interpolateColors, useCurrentFrame } from "remotion";
import { BuggyLanding } from "../components/BuggyLanding";
import { Browser } from "../components/Browser";
import { Camera, type Shot } from "../components/Camera";
import { Sfx, Sound, keyClick, type Cue } from "../components/Sfx";
import { LineKind, Terminal, type Rect, type TermLine } from "../components/Terminal";
import { lift, mix, tween } from "../ease";
import { COLORS } from "../theme";
import { applyKeys, BEATS, BROWSER_OPENS, BUILD, CAMERA_KEYS, Focus, Front, FRONT_KEYS, LIFT, LIMIT, NAV_CENTER, NAV_CHANGE, NAV_LEFT, Reply, Stroke, SWAPS, TITLE_FIX } from "./coldOpenTimeline";

const BROWSER = { x: 470, y: 150, w: 940, h: 720 };
export const TERMINAL = { x: 665, y: 288, w: 820, h: 640 };

export const SHOTS: Record<Focus, Shot> = {
  [Focus.Prompt]: { x: 1075, y: 608, scale: 1.4 },
  [Focus.Page]: { x: 940, y: 510, scale: 1.45 },
  [Focus.Stack]: { x: 977, y: 539, scale: 1.3 },
  [Focus.Limit]: { x: 1075, y: 608, scale: 1.55 },
};

const SPINNER = ["·", "✢", "✳", "✶", "✻", "✽", "✻", "✶", "✳", "✢"];
const SPINNER_STEP = 3;
const BLINK = 15;
const BUILD_STEPS = ["Writing index.html", "Writing styles.css", "Starting dev server"];
const NAV_START = 13;
const NAV_RIGHT = 78;
const NAV_MIDDLE = 50;
const BROWSER_OPEN = 22;
const BACK_DIM = 0.8;
const SHADOW = { rest: 0.45, lifted: 0.7 };

const buildSteps = (frame: number): TermLine[] =>
  BUILD_STEPS.filter((_, i) => frame >= BUILD.submit + ((i + 1) * BUILD.work) / (BUILD_STEPS.length + 1)).map((text) => ({
    kind: LineKind.Status,
    text,
  }));

const terminalLines = (frame: number): TermLine[] => {
  const lines: TermLine[] = [];

  for (const beat of BEATS) {
    if (frame < beat.submit) {
      break;
    }

    lines.push({ kind: LineKind.User, text: beat.prompt });

    if (beat === BUILD) {
      lines.push(...buildSteps(frame));
    }

    if (frame < beat.replyAt) {
      lines.push({ kind: LineKind.Spinner, text: beat === BUILD ? "Building…" : "Thinking…" });
      continue;
    }

    lines.push({ kind: beat.kind === Reply.Limit ? LineKind.Limit : LineKind.Agent, text: beat.reply });
  }

  return lines;
};

const typedInput = (frame: number) => {
  const beat = BEATS.find((b) => frame >= b.typeStart && frame < b.submit);

  if (!beat) {
    return { input: "", typing: false };
  }

  const typed = beat.strokes.filter((s) => s.at <= frame).map((s) => s.key);

  return { input: applyKeys(typed.join("")), typing: true };
};

const cursorOn = (frame: number, typing: boolean) => {
  if (frame >= LIMIT.replyAt) {
    return false;
  }

  if (typing) {
    return true;
  }

  return Math.floor(frame / BLINK) % 2 === 0;
};

const navCenter = (frame: number) => {
  const right = mix(NAV_START, NAV_RIGHT, tween(frame, NAV_LEFT.changeAt, NAV_CHANGE));

  return mix(right, NAV_MIDDLE, tween(frame, NAV_CENTER.changeAt, NAV_CHANGE));
};

const CUES: Cue[] = [
  ...BEATS.flatMap((beat) => [
    ...beat.strokes.map((s, i) => (s.stroke === Stroke.Backspace ? { at: s.at, sound: Sound.Backspace, volume: 0.4 } : keyClick(s.at, i))),
    { at: beat.submit, sound: Sound.Enter, volume: 0.5 },
  ]),
  ...CAMERA_KEYS.filter((key) => key.at > 0).map((key) => ({ at: key.at, sound: Sound.Whoosh, volume: 0.3 })),
  ...SWAPS.map((swap) => ({ at: swap.at, sound: Sound.Tap, volume: 0.3 })),
  { at: BROWSER_OPENS, sound: Sound.Pop, volume: 0.4 },
  { at: LIMIT.replyAt, sound: Sound.Chime, volume: 0.6 },
];

const SHAKE = [
  { x: 14, y: -4, hue: 40 },
  { x: -18, y: 6, hue: -60 },
  { x: 9, y: 0, hue: 25 },
  { x: -6, y: -8, hue: 0 },
  { x: 22, y: 3, hue: -35 },
  { x: -4, y: 2, hue: 0 },
];
const FREEZE_DELAY = 10;
const FREEZE_LENGTH = 26;

const pageShake = (frame: number) => {
  const step = SHAKE[frame - TITLE_FIX.changeAt];

  if (!step) {
    return undefined;
  }

  return { transform: `translate(${step.x}px, ${step.y}px)`, filter: `hue-rotate(${step.hue}deg)` };
};

const frozen = (frame: number) => {
  const t = tween(frame, LIMIT.replyAt + FREEZE_DELAY, FREEZE_LENGTH);

  return `grayscale(${t}) brightness(${1 - 0.45 * t})`;
};

const glitches = (frame: number) => ({
  button: tween(frame, NAV_LEFT.changeAt, NAV_CHANGE),
  image: tween(frame, NAV_CENTER.changeAt, NAV_CHANGE),
  font: tween(frame, TITLE_FIX.changeAt, NAV_CHANGE),
});

const frontKey = (frame: number) => FRONT_KEYS.filter((key) => key.at <= frame).pop() ?? FRONT_KEYS[0];

const stacking = (frame: number, rect: Rect, window: Front) => {
  const key = frontKey(frame);
  const front = key.front === window;
  const t = front ? lift(frame, key.at, LIFT) : 1;
  const scale = front ? mix(0.98, 1, t) : 1;
  const shadow = front ? mix(SHADOW.rest, SHADOW.lifted, t) : SHADOW.rest;
  const dim = front ? 1 : mix(1, BACK_DIM, lift(frame, key.at, LIFT));

  return {
    zIndex: front ? 2 : 1,
    transformOrigin: `${rect.x + rect.w / 2}px ${rect.y + rect.h / 2}px`,
    transform: `scale(${scale})`,
    dim,
    shadow: `0 ${mix(30, 60, shadow)}px ${mix(90, 160, shadow)}px rgba(0,0,0,${shadow})`,
  };
};

const Shadow = ({ rect, shadow }: { rect: Rect; shadow: string }) => (
  <div style={{ position: "absolute", left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: 18, boxShadow: shadow }} />
);

export const ColdOpen = () => {
  const frame = useCurrentFrame();
  const { input, typing } = typedInput(frame);
  const open = tween(frame, BROWSER_OPENS, BROWSER_OPEN);
  const recolor = tween(frame, TITLE_FIX.changeAt, NAV_CHANGE);
  const titleColor = interpolateColors(Math.min(recolor, 1), [0, 1], [COLORS.pageRed, COLORS.pageBlue]);

  const term = stacking(frame, TERMINAL, Front.Terminal);
  const page = stacking(frame, BROWSER, Front.Browser);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, #15151a 0%, ${COLORS.stage} 70%)` }}>
      <Sfx cues={CUES} />
      <Camera keys={CAMERA_KEYS} shots={SHOTS}>
        <div style={{ position: "absolute", inset: 0, zIndex: term.zIndex, transformOrigin: term.transformOrigin, transform: term.transform, filter: `brightness(${term.dim})` }}>
          <Shadow rect={TERMINAL} shadow={term.shadow} />
          <Terminal
            rect={TERMINAL}
            title="agent — ~/startup"
            lines={terminalLines(frame)}
            input={input}
            cursorOn={cursorOn(frame, typing)}
            spinnerGlyph={SPINNER[Math.floor(frame / SPINNER_STEP) % SPINNER.length]}
          />
        </div>
        {open > 0 && (
          <div style={{ position: "absolute", inset: 0, zIndex: page.zIndex, transformOrigin: page.transformOrigin, transform: page.transform }}>
            <div style={{ position: "absolute", inset: 0, filter: `${frozen(frame)} brightness(${page.dim})`, ...pageShake(frame) }}>
              <Shadow rect={BROWSER} shadow={page.shadow} />
              <Browser rect={BROWSER} url="localhost:3000" tab="Lumen — Home" opacity={Math.min(open, 1)} scale={mix(0.92, 1, open)}>
                <BuggyLanding navCenter={navCenter(frame)} titleColor={titleColor} glitches={glitches(frame)} />
              </Browser>
            </div>
          </div>
        )}
      </Camera>
    </AbsoluteFill>
  );
};
