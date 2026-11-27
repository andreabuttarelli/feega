import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { ReactNode } from "react";
import { Browser, Chrome, CHROME_HEIGHT } from "../components/Browser";
import { Camera, type Shot } from "../components/Camera";
import { App, Desktop, dockIconCenter, type Pointer } from "../components/Desktop";
import { Feed, FEED_LEFT, FEED_WIDTH, HOOK, HOOK_COMMAND, HOOK_CENTER, HOOK_HEIGHT, PostCard } from "../components/Feed";
import { Sfx, Sound, type Cue } from "../components/Sfx";
import { PixelgodTui, Shell, type Rect } from "../components/Terminal";
import { VSCODE, VSCodeWindow } from "../components/VSCode";
import { lift, mix, settle, tween } from "../ease";
import { COLORS, SANS } from "../theme";
import { Focus as ColdFocus } from "./coldOpenTimeline";
import { SHOTS as COLD_SHOTS } from "./ColdOpen";

enum Focus {
  Wide = "wide",
  Dock = "dock",
  Hook = "hook",
  Prompt = "prompt",
}

const WINDOW: Rect = { x: 240, y: 80, w: 1440, h: 880 };
const HOOK_Y = 540;
const SCROLL_END = HOOK_CENTER - (HOOK_Y - WINDOW.y - CHROME_HEIGHT);
const BLUR_PER_PX = 0.35;
const MAX_BLUR = 22;
const CARD_LEFT = WINDOW.x + FEED_LEFT;
const SELECT_Y = HOOK_Y - HOOK_HEIGHT / 2 + 104;
const SELECT_FROM = CARD_LEFT + 296;
const SELECT_TO = SELECT_FROM + 134;

const T = {
  crtLine: 6,
  crtOpen: 5,
  crtOpenLength: 14,
  crtEnd: 26,
  dockIn: 16,
  clickX: 88,
  wideOut: 94,
  browserOpen: 96,
  open: 24,
  scroll: 120,
  scrollLength: 80,
  zoom: 196,
  isolate: 210,
  fade: 22,
  count: 222,
  countLength: 50,
  like: 250,
  grab: 286,
  dragLength: 16,
  copy: 308,
  keycapLength: 20,
  dockBack: 324,
  clickCode: 364,
  codeWide: 368,
  codeOpen: 370,
  paste: 398,
  enter: 408,
  tui: 414,
  toPrompt: 436,
  stage: 438,
  end: 472,
};

export const INTRO_FRAMES = T.end;

const SHOTS: Record<Focus, Shot> = {
  [Focus.Wide]: { x: 960, y: 540, scale: 1 },
  [Focus.Dock]: { x: 960, y: 820, scale: 2.05 },
  [Focus.Hook]: { x: 960, y: HOOK_Y, scale: 1.75 },
  [Focus.Prompt]: COLD_SHOTS[ColdFocus.Prompt],
};

const CAMERA_KEYS = [
  { at: 0, focus: Focus.Wide },
  { at: T.dockIn, focus: Focus.Dock, move: 26 },
  { at: T.wideOut, focus: Focus.Wide, move: 30 },
  { at: T.zoom, focus: Focus.Hook },
  { at: T.dockBack, focus: Focus.Dock, move: 26 },
  { at: T.codeWide, focus: Focus.Wide, move: 30 },
  { at: T.toPrompt, focus: Focus.Prompt },
];

type Waypoint = { at: number; x: number; y: number };

const DOCK_Y = 1034;
const AWAY_Y = 800;
const LEAVE = 14;

const glidePath = (keys: Waypoint[], click: number): Waypoint[] => {
  const last = keys[keys.length - 1];

  return [...keys, { at: click + 2, x: last.x, y: DOCK_Y }, { at: click + 2 + LEAVE, x: last.x + 40, y: AWAY_Y }];
};

const PATHS = [
  glidePath(
    [
      { at: 30, x: 1330, y: 760 },
      { at: 48, x: 1240, y: DOCK_Y },
      { at: 70, x: 690, y: DOCK_Y },
      { at: 84, x: 735, y: DOCK_Y },
    ],
    T.clickX,
  ),
  glidePath(
    [
      { at: T.grab - 18, x: SELECT_FROM - 40, y: SELECT_Y + 50 },
      { at: T.grab - 2, x: SELECT_FROM, y: SELECT_Y },
      { at: T.grab, x: SELECT_FROM, y: SELECT_Y },
      { at: T.grab + T.dragLength, x: SELECT_TO, y: SELECT_Y },
      { at: T.dockBack + 2, x: SELECT_TO, y: SELECT_Y },
      { at: T.dockBack + 24, x: 1200, y: DOCK_Y },
      { at: T.clickCode - 6, x: 915, y: DOCK_Y },
    ],
    T.clickCode,
  ),
];

const pathEase = Easing.bezier(0.45, 0, 0.2, 1);
const HOVER_FROM = 900;
const HOVER_RANGE = 90;
const CURSOR_FADE = 6;

const along = (path: Waypoint[], frame: number) => {
  const next = path.findIndex((p) => p.at > frame);

  if (next === -1) {
    return path[path.length - 1];
  }

  if (next === 0) {
    return path[0];
  }

  const a = path[next - 1];
  const b = path[next];
  const t = pathEase((frame - a.at) / (b.at - a.at));

  return { at: frame, x: mix(a.x, b.x, t), y: mix(a.y, b.y, t) };
};

const activePath = (frame: number) => PATHS.find((p) => frame >= p[0].at && frame <= p[p.length - 1].at + CURSOR_FADE) ?? null;

const cursorAt = (frame: number) => {
  const path = activePath(frame);

  if (!path) {
    return null;
  }

  const point = along(path, frame);
  const fadeIn = interpolate(frame, [path[0].at, path[0].at + CURSOR_FADE], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const end = path[path.length - 1].at;
  const fadeOut = interpolate(frame, [end - CURSOR_FADE, end + CURSOR_FADE], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return { x: point.x, y: point.y, opacity: Math.min(fadeIn, fadeOut) };
};

const pointerAt = (frame: number): Pointer => {
  const cursor = cursorAt(frame);

  if (!cursor) {
    return { x: 960, hover: 0 };
  }

  return { x: cursor.x, hover: settle((cursor.y - HOVER_FROM) / HOVER_RANGE) };
};

const BOUNCE_LENGTH = 16;
const PRESS_LENGTH = 4;

const bounceAt = (frame: number, click: number) => Math.sin(Math.PI * Math.min(1, Math.max(0, (frame - click) / BOUNCE_LENGTH)));

const selectionAt = (frame: number) => tween(frame, T.grab, T.dragLength);

const CUES: Cue[] = [
  { at: 0, sound: Sound.Power, volume: 0.5 },
  { at: T.dockIn, sound: Sound.Whoosh, volume: 0.3 },
  { at: T.clickX, sound: Sound.Mouse, volume: 0.6 },
  { at: T.browserOpen, sound: Sound.Pop, volume: 0.35 },
  { at: T.scroll + 6, sound: Sound.Whoosh, volume: 0.5 },
  { at: T.zoom, sound: Sound.Whoosh, volume: 0.38 },
  { at: T.like, sound: Sound.Pop, volume: 0.25 },
  { at: T.grab, sound: Sound.Mouse, volume: 0.4 },
  { at: T.copy, sound: Sound.Tap, volume: 0.5 },
  { at: T.dockBack + 4, sound: Sound.Whoosh, volume: 0.3 },
  { at: T.clickCode, sound: Sound.Mouse, volume: 0.6 },
  { at: T.codeOpen, sound: Sound.Pop, volume: 0.35 },
  { at: T.paste, sound: Sound.Tap, volume: 0.5 },
  { at: T.enter, sound: Sound.Enter, volume: 0.5 },
  { at: T.tui, sound: Sound.Chime, volume: 0.25 },
  { at: T.toPrompt, sound: Sound.Whoosh, volume: 0.38 },
];

const scrollAt = (frame: number) => SCROLL_END * tween(frame, T.scroll, T.scrollLength);

const COUNT_GROWTH = 1.8;
const HOOK_TOTALS = [12.4, 48.1, 391, 18.2];
const HOOK_UNITS = ["K", "K", "K", "M"];

const hookStats = (frame: number): [string, string, string, string] => {
  const k = mix(1, COUNT_GROWTH, tween(frame, T.count, T.countLength));
  const digits = (v: number) => (v >= 100 ? Math.round(v).toString() : v.toFixed(1));

  return HOOK_TOTALS.map((v, i) => digits(v * k) + HOOK_UNITS[i]) as [string, string, string, string];
};

const fromDock = (app: App, rect: Rect, t: number, pointer: Pointer) => {
  const dock = dockIconCenter(app, pointer);
  const dx = (dock.x - (rect.x + rect.w / 2)) * (1 - t);
  const dy = (dock.y - (rect.y + rect.h / 2)) * (1 - t);

  return `translate(${dx}px, ${dy}px) scale(${mix(0.06, 1, t)})`;
};

const Window = ({ rect, transform, opacity, children }: { rect: Rect; transform: string; opacity: number; children: ReactNode }) => (
  <div style={{ position: "absolute", inset: 0, transformOrigin: `${rect.x + rect.w / 2}px ${rect.y + rect.h / 2}px`, transform, opacity }}>{children}</div>
);

const Arrow = ({ x, y, opacity, pressed }: { x: number; y: number; opacity: number; pressed: boolean }) => (
  <svg width="20" height="29" viewBox="0 0 30 44" style={{ position: "absolute", left: 0, top: 0, transform: `translate(${x - 2}px, ${y - 1}px) scale(${pressed ? 0.9 : 1})`, transformOrigin: "2px 1px", opacity }}>
    <path d="M3 2v33l8-8 6 14 6-3-6-13h11z" fill="#000" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round" />
  </svg>
);

const Keycap = ({ frame, at, letter }: { frame: number; at: number; letter: string }) => {
  const shown = lift(frame, at, 6) - tween(frame, at + T.keycapLength - 6, 6);

  if (shown <= 0) {
    return null;
  }

  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 150, display: "flex", justifyContent: "center", gap: 14, opacity: Math.min(1, shown), transform: `translateY(${(1 - shown) * 30}px) scale(${mix(0.85, 1, shown)})` }}>
      {["⌘", letter].map((k) => (
        <div
          key={k}
          style={{
            width: 96,
            height: 96,
            borderRadius: 20,
            background: "linear-gradient(180deg,#3a3a42,#1c1c22)",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "0 6px 0 #0c0c10, 0 20px 50px rgba(0,0,0,0.5)",
            color: "#fff",
            fontSize: 46,
            fontFamily: SANS,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {k}
        </div>
      ))}
    </div>
  );
};

const PowerOn = ({ frame, children }: { frame: number; children: ReactNode }) => {
  if (frame >= T.crtEnd) {
    return <>{children}</>;
  }

  const lineX = lift(frame, 0, T.crtLine);
  const openY = tween(frame, T.crtOpen, T.crtOpenLength);
  const flash = interpolate(frame, [T.crtOpen + 4, T.crtOpen + 8, T.crtEnd], [0, 0.45, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lineFade = 1 - tween(frame, T.crtOpen + 2, 8);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `scale(${lineX}, ${mix(0.004, 1, openY)})`, filter: `brightness(${mix(5, 1, openY)})` }}>{children}</AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 538,
          width: 1920,
          height: 4,
          background: "#fff",
          boxShadow: "0 0 24px 8px rgba(200,220,255,0.9), 0 0 90px 30px rgba(140,170,255,0.5)",
          transform: `scaleX(${lineX}) scaleY(${mix(1, 6, openY)})`,
          opacity: lineFade,
        }}
      />
      <AbsoluteFill style={{ background: "#e8eeff", opacity: flash }} />
    </AbsoluteFill>
  );
};

export const Intro = () => {
  const frame = useCurrentFrame();
  const pointer = pointerAt(frame);
  const cursor = cursorAt(frame);
  const pressed = [T.clickX, T.clickCode].some((c) => frame >= c && frame < c + PRESS_LENGTH) || (frame >= T.grab && frame < T.grab + T.dragLength + 2);

  const open = tween(frame, T.browserOpen, T.open);
  const away = tween(frame, T.isolate, T.fade) - tween(frame, T.dockBack - 4, T.fade);
  const codeOpen = tween(frame, T.codeOpen, T.open);
  const stage = tween(frame, T.stage, T.fade + 6);
  const scroll = scrollAt(frame);
  const blur = Math.min(MAX_BLUR, Math.abs(scrollAt(frame + 1) - scroll) * BLUR_PER_PX);
  const isolated = frame >= T.scroll + T.scrollLength;
  const browserOpacity = Math.min(open * 3, 1) * (1 - away);
  const xRunning = frame >= T.clickX;

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, #15151a 0%, ${COLORS.stage} 70%)` }}>
      <Sfx cues={CUES} />
      <PowerOn frame={frame}>
        <Camera keys={CAMERA_KEYS} shots={SHOTS}>
          <Desktop
            opacity={(1 - away * 0.85) * (1 - stage)}
            pointer={pointer}
            bounce={{ [App.X]: bounceAt(frame, T.clickX), [App.VSCode]: bounceAt(frame, T.clickCode) }}
            running={[App.Files, ...(xRunning ? [App.X] : []), ...(frame >= T.clickCode ? [App.VSCode] : [])]}
          />
          {browserOpacity > 0 && (
            <Window rect={WINDOW} transform={fromDock(App.X, WINDOW, open, pointer)} opacity={browserOpacity}>
              <Browser chrome={Chrome.Dark} rect={WINDOW} url="x.com/home" tab="Home / X" opacity={1} scale={1}>
                <Feed offset={scroll} blur={blur} hideHook={isolated} />
              </Browser>
            </Window>
          )}
          {isolated && (
            <div
              style={{
                position: "absolute",
                left: WINDOW.x + FEED_LEFT,
                top: HOOK_Y - HOOK_HEIGHT / 2,
                width: FEED_WIDTH,
                height: HOOK_HEIGHT,
                background: "#000",
                borderRadius: 18 * away,
                border: `1px solid rgba(47,51,54,${away})`,
                boxShadow: `0 30px 90px rgba(0,0,0,${0.7 * away})`,
              }}
            >
              <PostCard post={{ ...HOOK, stats: hookStats(frame) }} liked={settle(Math.min(1, Math.max(0, (frame - T.like) / 6)))} selected={selectionAt(frame)} />
            </div>
          )}
          {codeOpen > 0 && (
            <Window rect={VSCODE} transform={fromDock(App.VSCode, VSCODE, codeOpen, pointer)} opacity={Math.min(codeOpen * 3, 1)}>
              <VSCodeWindow rect={VSCODE} shell={frame >= T.tui ? "node" : "zsh"}>
                {frame >= T.tui ? (
                  <PixelgodTui lines={[]} input="" cursorOn={frame % 30 < 15} spinnerGlyph="" />
                ) : (
                  <Shell command={frame >= T.paste ? HOOK_COMMAND : ""} cursorOn={frame % 30 < 15 || frame >= T.paste} />
                )}
              </VSCodeWindow>
            </Window>
          )}
          {cursor && <Arrow x={cursor.x} y={cursor.y} opacity={cursor.opacity} pressed={pressed} />}
        </Camera>
        <Keycap frame={frame} at={T.copy} letter="C" />
        <Keycap frame={frame} at={T.paste} letter="V" />
      </PowerOn>
    </AbsoluteFill>
  );
};
