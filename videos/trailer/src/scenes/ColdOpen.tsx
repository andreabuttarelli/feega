import { AbsoluteFill, interpolateColors, useCurrentFrame } from "remotion";
import { BuggyLanding } from "../components/BuggyLanding";
import { Browser } from "../components/Browser";
import { Camera, type Shot } from "../components/Camera";
import { Sfx, Sound, keyClick, type Cue } from "../components/Sfx";
import { LineKind, Terminal, type TermLine } from "../components/Terminal";
import { mix, tween } from "../ease";
import { COLORS } from "../theme";
import { applyKeys, BEATS, BUILD, CAMERA_KEYS, Focus, LIMIT, NAV_CENTER, NAV_CHANGE, NAV_LEFT, Reply, Stroke, TITLE_FIX } from "./coldOpenTimeline";

export const TERMINAL = { x: 100, y: 150, w: 760, h: 780 };
const BROWSER = { x: 900, y: 180, w: 940, h: 720 };

export const SHOTS: Record<Focus, Shot> = {
  [Focus.Prompt]: { x: 480, y: 700, scale: 1.6 },
  [Focus.Page]: { x: 1370, y: 540, scale: 1.45 },
  [Focus.Navbar]: { x: 1370, y: 400, scale: 1.45 },
  [Focus.Limit]: { x: 470, y: 780, scale: 1.9 },
};

const SPINNER = ["·", "✢", "✳", "✶", "✻", "✽", "✻", "✶", "✳", "✢"];
const SPINNER_STEP = 3;
const BLINK = 15;
const BUILD_STEPS = ["Writing index.html", "Writing styles.css", "Starting dev server"];
const NAV_START = 13;
const NAV_RIGHT = 78;
const NAV_MIDDLE = 50;
const BROWSER_LEAD = 8;
const BROWSER_OPEN = 22;

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
  ...CAMERA_KEYS.filter((key) => key.at > 0).map((key) => ({ at: key.at, sound: Sound.Whoosh, volume: 0.38 })),
  { at: BUILD.replyAt - BROWSER_LEAD, sound: Sound.Pop, volume: 0.4 },
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

export const ColdOpen = () => {
  const frame = useCurrentFrame();
  const { input, typing } = typedInput(frame);
  const open = tween(frame, BUILD.replyAt - BROWSER_LEAD, BROWSER_OPEN);
  const recolor = tween(frame, TITLE_FIX.changeAt, NAV_CHANGE);
  const titleColor = interpolateColors(Math.min(recolor, 1), [0, 1], [COLORS.pageRed, COLORS.pageBlue]);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, #15151a 0%, ${COLORS.stage} 70%)`}}>
      <Sfx cues={CUES} />
      <Camera keys={CAMERA_KEYS} shots={SHOTS}>
        <Terminal
          rect={TERMINAL}
          title="agent — ~/startup"
          lines={terminalLines(frame)}
          input={input}
          cursorOn={cursorOn(frame, typing)}
          spinnerGlyph={SPINNER[Math.floor(frame / SPINNER_STEP) % SPINNER.length]}
        />
        {open > 0 && (
          <div style={{ position: "absolute", inset: 0, filter: frozen(frame), ...pageShake(frame) }}>
          <Browser rect={BROWSER} url="localhost:3000" tab="Lumen — Home" opacity={Math.min(open, 1)} scale={mix(0.92, 1, open)}>
            <BuggyLanding navCenter={navCenter(frame)} titleColor={titleColor} glitches={glitches(frame)} />
          </Browser>
          </div>
        )}
      </Camera>
    </AbsoluteFill>
  );
};
