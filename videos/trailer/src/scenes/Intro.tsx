import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Browser, Chrome, CHROME_HEIGHT } from "../components/Browser";
import { Camera, type Shot } from "../components/Camera";
import { App, Desktop, dockIconCenter } from "../components/Desktop";
import { Feed, FEED_LEFT, FEED_WIDTH, HOOK, HOOK_CENTER, HOOK_HEIGHT, PostCard } from "../components/Feed";
import { Sfx, Sound, type Cue } from "../components/Sfx";
import { Terminal, type Rect } from "../components/Terminal";
import { mix, settle, tween } from "../ease";
import { COLORS } from "../theme";
import type { ReactNode } from "react";
import { Focus as ColdFocus } from "./coldOpenTimeline";
import { SHOTS as COLD_SHOTS, TERMINAL } from "./ColdOpen";

enum Focus {
  Wide = "wide",
  Hook = "hook",
  Prompt = "prompt",
}

const WINDOW: Rect = { x: 240, y: 80, w: 1440, h: 880 };
const HOOK_Y = 540;
const SCROLL_END = HOOK_CENTER - (HOOK_Y - WINDOW.y - CHROME_HEIGHT);
const BLUR_PER_PX = 0.35;
const MAX_BLUR = 22;

const T = {
  browserOpen: 8,
  open: 24,
  scroll: 36,
  scrollLength: 92,
  zoom: 124,
  isolate: 138,
  fade: 22,
  count: 150,
  countLength: 50,
  like: 178,
  zoomOut: 206,
  close: 224,
  closeLength: 18,
  terminalOpen: 240,
  toPrompt: 256,
  stage: 248,
  end: 290,
};

export const INTRO_FRAMES = T.end;

const SHOTS: Record<Focus, Shot> = {
  [Focus.Wide]: { x: 960, y: 540, scale: 1 },
  [Focus.Hook]: { x: 960, y: HOOK_Y, scale: 1.75 },
  [Focus.Prompt]: COLD_SHOTS[ColdFocus.Prompt],
};

const CAMERA_KEYS = [
  { at: 0, focus: Focus.Wide },
  { at: T.zoom, focus: Focus.Hook },
  { at: T.zoomOut, focus: Focus.Wide },
  { at: T.toPrompt, focus: Focus.Prompt },
];

const CUES: Cue[] = [
  { at: T.browserOpen, sound: Sound.Pop, volume: 0.35 },
  { at: T.scroll + 6, sound: Sound.Whoosh, volume: 0.5 },
  { at: T.zoom, sound: Sound.Whoosh, volume: 0.38 },
  { at: T.like, sound: Sound.Pop, volume: 0.25 },
  { at: T.zoomOut, sound: Sound.Whoosh, volume: 0.32 },
  { at: T.close, sound: Sound.Pop, volume: 0.25 },
  { at: T.terminalOpen, sound: Sound.Pop, volume: 0.35 },
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

const fromDock = (app: App, rect: Rect, t: number) => {
  const dock = dockIconCenter(app);
  const dx = (dock.x - (rect.x + rect.w / 2)) * (1 - t);
  const dy = (dock.y - (rect.y + rect.h / 2)) * (1 - t);

  return `translate(${dx}px, ${dy}px) scale(${mix(0.06, 1, t)})`;
};

const Window = ({ rect, transform, opacity, children }: { rect: Rect; transform: string; opacity: number; children: ReactNode }) => (
  <div style={{ position: "absolute", inset: 0, transformOrigin: `${rect.x + rect.w / 2}px ${rect.y + rect.h / 2}px`, transform, opacity }}>{children}</div>
);

export const Intro = () => {
  const frame = useCurrentFrame();
  const open = tween(frame, T.browserOpen, T.open);
  const away = tween(frame, T.isolate, T.fade) - tween(frame, T.zoomOut - 4, T.fade);
  const close = tween(frame, T.close, T.closeLength);
  const termOpen = tween(frame, T.terminalOpen, T.open);
  const stage = tween(frame, T.stage, T.fade + 6);
  const scroll = scrollAt(frame);
  const blur = Math.min(MAX_BLUR, Math.abs(scrollAt(frame + 1) - scroll) * BLUR_PER_PX);
  const isolated = frame >= T.scroll + T.scrollLength;
  const browserOpacity = Math.min(open * 3, 1) * (1 - away) * (1 - close);

  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, #15151a 0%, ${COLORS.stage} 70%)` }}>
      <Sfx cues={CUES} />
      <Desktop
        opacity={(1 - away * 0.85) * (1 - stage)}
        bounce={{ [App.Browser]: Math.sin(Math.PI * Math.min(1, Math.max(0, (frame - 2) / 14))), [App.Terminal]: Math.sin(Math.PI * Math.min(1, Math.max(0, (frame - (T.terminalOpen - 12)) / 14))) }}
        running={[App.Finder, ...(frame < T.close + T.closeLength ? [App.Browser] : []), ...(frame >= T.terminalOpen ? [App.Terminal] : [])]}
      />
      <Camera keys={CAMERA_KEYS} shots={SHOTS}>
        {browserOpacity > 0 && (
          <Window rect={WINDOW} transform={`${fromDock(App.Browser, WINDOW, open)} scale(${mix(1, 0.92, close)})`} opacity={browserOpacity}>
            <Browser chrome={Chrome.Dark} rect={WINDOW} url="social.example/home" tab="Home / Feed" opacity={1} scale={1}>
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
        {termOpen > 0 && (
          <Window rect={TERMINAL} transform={fromDock(App.Terminal, TERMINAL, termOpen)} opacity={Math.min(termOpen * 3, 1)}>
            <Terminal rect={TERMINAL} title="agent — ~/startup" lines={[]} input="" cursorOn={frame % 30 < 15} spinnerGlyph="" />
          </Window>
        )}
      </Camera>
    </AbsoluteFill>
  );
};
