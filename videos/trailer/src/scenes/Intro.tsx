import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import type { ReactNode } from "react";
import { Browser, Chrome, CHROME_HEIGHT } from "../components/Browser";
import { Camera, type Shot } from "../components/Camera";
import { App, Desktop, dockIconCenter, type Pointer } from "../components/Desktop";
import { Feed, FEED_LEFT, FEED_WIDTH, HOOK, HOOK_CENTER, HOOK_HEIGHT, PostCard } from "../components/Feed";
import { keyClick, Sfx, Sound, type Cue } from "../components/Sfx";
import { PixelgodTui, Shell, type Rect } from "../components/Terminal";
import { VSCODE, VSCodeWindow } from "../components/VSCode";
import { lift, mix, settle, tween } from "../ease";
import { COLORS } from "../theme";
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
const COMMAND = "npx pixelgod";
const KEY_GAP = 2;

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
  zoomOut: 272,
  close: 290,
  closeLength: 18,
  dockBack: 292,
  clickCode: 342,
  codeWide: 346,
  codeOpen: 348,
  typeStart: 376,
  enter: 376 + COMMAND.length * KEY_GAP + 8,
  tui: 376 + COMMAND.length * KEY_GAP + 14,
  toPrompt: 420,
  stage: 422,
  end: 456,
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
  { at: T.zoomOut, focus: Focus.Wide },
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
      { at: T.dockBack + 6, x: 1330, y: 760 },
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

const typedCommand = (frame: number) => COMMAND.slice(0, Math.max(0, Math.min(COMMAND.length, Math.floor((frame - T.typeStart) / KEY_GAP) + 1)));

const CUES: Cue[] = [
  { at: 0, sound: Sound.Power, volume: 0.5 },
  { at: T.dockIn, sound: Sound.Whoosh, volume: 0.3 },
  { at: T.clickX, sound: Sound.Mouse, volume: 0.6 },
  { at: T.browserOpen, sound: Sound.Pop, volume: 0.35 },
  { at: T.scroll + 6, sound: Sound.Whoosh, volume: 0.5 },
  { at: T.zoom, sound: Sound.Whoosh, volume: 0.38 },
  { at: T.like, sound: Sound.Pop, volume: 0.25 },
  { at: T.zoomOut, sound: Sound.Whoosh, volume: 0.32 },
  { at: T.close, sound: Sound.Pop, volume: 0.25 },
  { at: T.dockBack + 4, sound: Sound.Whoosh, volume: 0.3 },
  { at: T.clickCode, sound: Sound.Mouse, volume: 0.6 },
  { at: T.codeOpen, sound: Sound.Pop, volume: 0.35 },
  ...[...COMMAND].map((_, i) => keyClick(T.typeStart + i * KEY_GAP, i)),
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
  const pressed = [T.clickX, T.clickCode].some((c) => frame >= c && frame < c + PRESS_LENGTH);

  const open = tween(frame, T.browserOpen, T.open);
  const away = tween(frame, T.isolate, T.fade) - tween(frame, T.zoomOut - 4, T.fade);
  const close = tween(frame, T.close, T.closeLength);
  const codeOpen = tween(frame, T.codeOpen, T.open);
  const stage = tween(frame, T.stage, T.fade + 6);
  const scroll = scrollAt(frame);
  const blur = Math.min(MAX_BLUR, Math.abs(scrollAt(frame + 1) - scroll) * BLUR_PER_PX);
  const isolated = frame >= T.scroll + T.scrollLength;
  const browserOpacity = Math.min(open * 3, 1) * (1 - away) * (1 - close);
  const xRunning = frame >= T.clickX && frame < T.close + T.closeLength;

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
            <Window rect={WINDOW} transform={`${fromDock(App.X, WINDOW, open, pointer)} scale(${mix(1, 0.92, close)})`} opacity={browserOpacity}>
              <Browser chrome={Chrome.Dark} rect={WINDOW} url="x.com/home" tab="Home / X" opacity={1} scale={1}>
                <Feed offset={scroll} blur={blur} hideHook={isolated} />
              </Browser>
            </Window>
          )}
          {isolated && frame < T.close + T.closeLength && (
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
                opacity: 1 - close,
                transform: `scale(${mix(1, 0.92, close)})`,
              }}
            >
              <PostCard post={{ ...HOOK, stats: hookStats(frame) }} liked={settle(Math.min(1, Math.max(0, (frame - T.like) / 6)))} />
            </div>
          )}
          {codeOpen > 0 && (
            <Window rect={VSCODE} transform={fromDock(App.VSCode, VSCODE, codeOpen, pointer)} opacity={Math.min(codeOpen * 3, 1)}>
              <VSCodeWindow rect={VSCODE} shell={frame >= T.tui ? "node" : "zsh"}>
                {frame >= T.tui ? (
                  <PixelgodTui lines={[]} input="" cursorOn={frame % 30 < 15} spinnerGlyph="" />
                ) : (
                  <Shell command={typedCommand(frame)} cursorOn={frame < T.typeStart || frame % 30 < 15 || frame < T.enter} />
                )}
              </VSCodeWindow>
            </Window>
          )}
          {cursor && <Arrow x={cursor.x} y={cursor.y} opacity={cursor.opacity} pressed={pressed} />}
        </Camera>
      </PowerOn>
    </AbsoluteFill>
  );
};
