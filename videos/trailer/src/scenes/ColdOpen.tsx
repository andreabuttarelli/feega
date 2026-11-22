import { AbsoluteFill, interpolate, interpolateColors, useCurrentFrame } from "remotion";
import { BuggyLanding } from "../components/BuggyLanding";
import { Browser } from "../components/Browser";
import { Camera, type Shot } from "../components/Camera";
import { LineKind, Terminal, type TermLine } from "../components/Terminal";
import { mix, tween } from "../ease";
import { COLORS } from "../theme";
import { FRAMES_PER_CHAR } from "../timing";
import { BEATS, BUILD, CAMERA_KEYS, Focus, LIMIT, NAV_CENTER, NAV_CHANGE, NAV_LEFT, Reply, TITLE_FIX } from "./coldOpenTimeline";

const TERMINAL = { x: 100, y: 150, w: 760, h: 780 };
const BROWSER = { x: 900, y: 180, w: 940, h: 720 };

const SHOTS: Record<Focus, Shot> = {
  [Focus.Prompt]: { x: 480, y: 700, scale: 1.6 },
  [Focus.Wide]: { x: 960, y: 540, scale: 1 },
  [Focus.Navbar]: { x: 1370, y: 340, scale: 1.6 },
  [Focus.Title]: { x: 1260, y: 460, scale: 1.6 },
  [Focus.Limit]: { x: 470, y: 780, scale: 1.9 },
};

const SPINNER = ["·", "✢", "✳", "✶", "✻", "✽", "✻", "✶", "✳", "✢"];
const SPINNER_STEP = 3;
const BLINK = 15;
const BUILD_STEPS = ["Writing index.html", "Writing styles.css", "Starting dev server"];
const NAV_START = 26;
const NAV_RIGHT = 74;
const NAV_MIDDLE = 50;
const FADE_IN = 18;
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

  const count = Math.floor((frame - beat.typeStart) / FRAMES_PER_CHAR);

  return { input: beat.prompt.slice(0, count), typing: true };
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

export const ColdOpen = () => {
  const frame = useCurrentFrame();
  const { input, typing } = typedInput(frame);
  const open = tween(frame, BUILD.replyAt - BROWSER_LEAD, BROWSER_OPEN);
  const recolor = tween(frame, TITLE_FIX.changeAt, NAV_CHANGE);
  const titleColor = interpolateColors(Math.min(recolor, 1), [0, 1], [COLORS.pageRed, COLORS.pageBlue]);
  const fade = interpolate(frame, [0, FADE_IN], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, #15151a 0%, ${COLORS.stage} 70%)`, opacity: fade }}>
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
          <Browser rect={BROWSER} url="localhost:3000" tab="Lumen — Home" opacity={Math.min(open, 1)} scale={mix(0.92, 1, open)}>
            <BuggyLanding navCenter={navCenter(frame)} titleColor={titleColor} />
          </Browser>
        )}
      </Camera>
    </AbsoluteFill>
  );
};
