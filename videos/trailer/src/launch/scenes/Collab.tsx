import type { ReactNode } from "react";
import { siClaude } from "simple-icons";
import { useCurrentFrame } from "remotion";
import { Mark } from "../../components/brandIcons";
import { Sound, type Cue } from "../../components/Sfx";
import { lift, mix, tween } from "../../ease";
import { EDITOR_REST, FeegaEditor, LeftPanel, LibraryGhost, pressAmount, pricingRect } from "../editor/FeegaEditor";
import { BASE_FONT, PAGE, center, insertY, libraryRect, type Point, type Rect } from "../editor/layout";
import { Align, Headline, assembleTicks, boxPopAt } from "../Headline";
import { Pointer, pointerAt, type Click } from "../Pointer";
import { Place, Section } from "../Section";
import { MONO, Tone, UI } from "../style";

export const COLLAB_FRAMES = 204;
export const COLLAB_TONE = Tone.Ink;

const GRAB_AT = 18;
const DROP_AT = 54;
const LINE_AT = 40;
const LAYERS_AT = DROP_AT + 8;
const HEAD_AT = 80;
const TERM_AT = 84;
const PROMPT_AT = 106;
const THINK_AT = 124;
const REPLY_AT = 136;
const DIFF_AT = 140;
const DIFF_STEP = 3;
const APPLY_AT = 152;
const DONE_AT = 172;
const MAYA_AT = 96;

const BOX = "0 0 24 24";
const CLAUDE = `#${siClaude.hex}`;
const MAYA = "#e255a1";
const POINTER_SIZE = 1.6;
const TERMINAL: Rect = { x: 96, y: 290, w: 940, h: 640 };

type Camera = { x: number; y: number; scale: number };

const CARD = libraryRect(0);
const CARD_CENTER = center(CARD);
const DROP_POINT: Point = { x: PAGE.x + 300, y: insertY(BASE_FONT) + 6 };
const PRICING = pricingRect(BASE_FONT, 0);

const CLOSE: Camera = { x: 560 - CARD_CENTER.x * 2.3, y: 480 - CARD_CENTER.y * 2.3, scale: 2.3 };
const WHOLE: Camera = { x: 90, y: 24, scale: 1.36 };
const SIDE: Camera = { x: 770, y: 350, scale: 0.84 };

const cameraAt = (frame: number): Camera => {
  const out = tween(frame, GRAB_AT - 2, DROP_AT - GRAB_AT + 4);
  const side = tween(frame, TERM_AT - 6, 22);
  const a = { x: mix(CLOSE.x, WHOLE.x, out), y: mix(CLOSE.y, WHOLE.y, out), scale: mix(CLOSE.scale, WHOLE.scale, out) };

  return { x: mix(a.x, SIDE.x, side), y: mix(a.y, SIDE.y, side), scale: mix(a.scale, SIDE.scale, side) };
};

const PATH = [
  { at: 2, x: 180, y: 560 },
  { at: GRAB_AT - 3, ...CARD_CENTER },
  { at: GRAB_AT + 2, ...CARD_CENTER },
  { at: DROP_AT - 2, ...DROP_POINT },
  { at: DROP_AT + 16, x: DROP_POINT.x + 260, y: DROP_POINT.y + 230 },
];

export const COLLAB_CLICKS: Click[] = [
  { label: "grab pricing", at: GRAB_AT, path: PATH, rect: CARD },
  { label: "drop in preview", at: DROP_AT, path: PATH, rect: { x: PAGE.x + 20, y: DROP_POINT.y - 24, w: PAGE.w - 40, h: 48 } },
];

const MAYA_PATH = [
  { at: MAYA_AT, x: PAGE.x + 640, y: PAGE.y + 690 },
  { at: MAYA_AT + 26, x: PRICING.x + 470, y: PRICING.y + 130 },
  { at: APPLY_AT + 4, x: PRICING.x + 360, y: PRICING.y + 110 },
  { at: APPLY_AT + 30, x: PRICING.x + 300, y: PRICING.y + 70 },
  { at: COLLAB_FRAMES, x: PRICING.x + 330, y: PRICING.y + 80 },
];

const PROMPT = "make the pricing cards 3 columns and highlight Pro";

enum Line {
  Same = "same",
  Removed = "removed",
  Added = "added",
}

const LINE_COLOR: Record<Line, { fg: string; bg: string; sign: string }> = {
  [Line.Same]: { fg: "#a8a59e", bg: "transparent", sign: " " },
  [Line.Removed]: { fg: "#ff9a9a", bg: "rgba(255,90,90,.12)", sign: "-" },
  [Line.Added]: { fg: "#9be3b4", bg: "rgba(80,220,140,.12)", sign: "+" },
};

const DIFF: { kind: Line; n: number; text: string }[] = [
  { kind: Line.Removed, n: 8, text: '<div class="grid grid-cols-2 gap-4">' },
  { kind: Line.Added, n: 8, text: '<div class="grid grid-cols-3 gap-4">' },
  { kind: Line.Same, n: 9, text: "  {#each plans as plan}" },
  { kind: Line.Removed, n: 10, text: "    <PlanCard {plan} />" },
  { kind: Line.Added, n: 10, text: '    <PlanCard {plan} featured={plan.pro} />' },
];

const diffAt = (i: number) => DIFF_AT + i * DIFF_STEP;

export const COLLAB_CUES: Cue[] = [
  { at: GRAB_AT, sound: Sound.ClickB, volume: 0.6 },
  { at: GRAB_AT + 4, sound: Sound.Whoosh, volume: 0.35 },
  { at: DROP_AT, sound: Sound.ClickB, volume: 0.6 },
  { at: DROP_AT + 4, sound: Sound.Pop, volume: 0.5 },
  { at: TERM_AT, sound: Sound.Whoosh, volume: 0.35 },
  ...assembleTicks(HEAD_AT).map((at) => ({ at, sound: Sound.Tap, volume: 0.12 })),
  { at: boxPopAt(HEAD_AT), sound: Sound.Pop, volume: 0.55, beat: true },
  { at: PROMPT_AT, sound: Sound.Tap, volume: 0.4 },
  { at: PROMPT_AT + 18, sound: Sound.Enter, volume: 0.4 },
  { at: REPLY_AT, sound: Sound.Pop, volume: 0.4 },
  ...DIFF.map((_, i) => ({ at: diffAt(i), sound: Sound.Tap, volume: 0.26 })),
  { at: APPLY_AT + 2, sound: Sound.Whoosh, volume: 0.25 },
  { at: DONE_AT, sound: Sound.Chime, volume: 0.35 },
];

const Appear = ({ at, children }: { at: number; children: ReactNode }) => {
  const frame = useCurrentFrame();

  if (frame < at) {
    return null;
  }

  const p = lift(frame, at, 10);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>{children}</div>;
};

const Terminal = () => {
  const frame = useCurrentFrame();
  const typed = Math.max(0, Math.floor((frame - PROMPT_AT) * 3.2));
  const thinking = frame >= THINK_AT && frame < REPLY_AT;
  const spinner = "✻✳✢·"[Math.floor(frame / 3) % 4];

  return (
    <div style={{ width: TERMINAL.w, height: TERMINAL.h, borderRadius: 14, overflow: "hidden", background: "#141413", boxShadow: "0 0 0 1px #3a3a38, 0 40px 100px rgba(0,0,0,.45)", fontFamily: MONO, fontSize: 18, color: "#e9e7e2", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", background: "#1d1d1c", borderBottom: "1px solid #2e2e2c", fontFamily: UI, fontSize: 14, color: "#8a8780" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
        ))}
        <span style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 18, color: "#f0eee9" }}>
          <Mark mark={{ path: siClaude.path, viewBox: BOX }} size={16} color={CLAUDE} />
          claude — ~/lumen
        </span>
      </div>
      <div style={{ flex: 1, padding: "18px 24px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
        <div style={{ border: `1.5px solid ${CLAUDE}`, borderRadius: 10, padding: "10px 16px", width: 520 }}>
          <div>
            <span style={{ color: CLAUDE }}>✻</span> Welcome to <b>Claude Code</b>
          </div>
          <div style={{ color: "#8a8780", fontSize: 15 }}>cwd: ~/lumen</div>
        </div>
        {frame >= PROMPT_AT ? (
          <div style={{ borderRadius: 10, background: "#1f1f1e", padding: "10px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#ff8a3d", fontSize: 15 }}>
              <span style={{ width: 9, height: 9, background: "#ff5100" }} />
              Feega · section.pricing · Pricing.svelte:3
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={{ color: "#8a8780" }}>&gt; </span>
              {PROMPT.slice(0, typed)}
              {typed < PROMPT.length && frame % 10 < 6 ? <span style={{ background: "#e9e7e2" }}>&nbsp;</span> : null}
            </div>
          </div>
        ) : (
          <div style={{ border: "1px solid #3a3a38", borderRadius: 8, padding: "8px 14px", color: "#8a8780" }}>&gt; ▍</div>
        )}
        {thinking ? (
          <div style={{ color: CLAUDE }}>
            {spinner} Reading Pricing.svelte… <span style={{ color: "#8a8780" }}>(esc to interrupt)</span>
          </div>
        ) : null}
        <Appear at={REPLY_AT}>
          <div>
            <span style={{ color: "#3ccf6e" }}>⏺</span> <b>Update</b>(src/lib/Pricing.svelte)
            <div style={{ marginTop: 6, marginLeft: 22, borderLeft: "1px solid #3a3a38", fontSize: 16 }}>
              {DIFF.map((d, i) => {
                const s = LINE_COLOR[d.kind];
                const p = lift(frame, diffAt(i), 8);

                return frame >= diffAt(i) ? (
                  <div key={i} style={{ display: "flex", gap: 12, padding: "2px 12px", background: s.bg, color: s.fg, whiteSpace: "pre", opacity: p, transform: `translateX(${(1 - p) * 16}px)` }}>
                    <span style={{ width: 24, color: "#6b6964", textAlign: "right" }}>{d.n}</span>
                    <span>{s.sign}</span>
                    {d.text}
                  </div>
                ) : null;
              })}
            </div>
          </div>
        </Appear>
        <Appear at={DONE_AT}>
          <div style={{ color: "#3ccf6e" }}>
            ✓ <span style={{ color: "#e9e7e2" }}>Pricing.svelte updated · live in Feega</span>
          </div>
        </Appear>
      </div>
    </div>
  );
};

const Teammate = ({ frame, scale }: { frame: number; scale: number }) => {
  if (frame < MAYA_AT) {
    return null;
  }

  const p = pointerAt(frame, MAYA_PATH);
  const show = lift(frame, MAYA_AT, 10);

  return (
    <div style={{ position: "absolute", left: p.x, top: p.y, zIndex: 40, opacity: show, transform: `scale(${1.3 / scale})`, transformOrigin: "0 0" }}>
      <svg width={20} height={24} viewBox="0 0 17 20" style={{ display: "block" }}>
        <path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" fill={MAYA} stroke="#fff" strokeWidth={1.2} strokeLinejoin="round" />
      </svg>
      <span style={{ position: "absolute", left: 14, top: 18, padding: "2px 8px", borderRadius: 999, background: MAYA, color: "#fff", fontFamily: UI, fontSize: 12, fontWeight: 600 }}>Maya</span>
    </div>
  );
};

export const Collab = () => {
  const frame = useCurrentFrame();
  const cam = cameraAt(frame);
  const pointer = pointerAt(frame, PATH);
  const dragging = frame >= GRAB_AT && frame < DROP_AT;
  const reveal = tween(frame, TERM_AT, 20);
  const push = 1 + 0.05 * tween(frame, APPLY_AT - 4, 18);
  const state = {
    ...EDITOR_REST,
    left: frame >= LAYERS_AT ? LeftPanel.Layers : LeftPanel.Library,
    library: { pick: 0, drop: tween(frame, LINE_AT, 8), inserted: tween(frame, DROP_AT, 12) },
    agent: tween(frame, APPLY_AT + 2, 16),
    agentGlow: tween(frame, APPLY_AT, 6) - tween(frame, DONE_AT + 14, 12),
    saved: tween(frame, DROP_AT + 6, 6) - tween(frame, TERM_AT, 6),
    presses: [{ rect: CARD, amount: pressAmount(frame, GRAB_AT) }],
  };
  const userCursor = 1 - tween(frame, TERM_AT - 4, 8);

  return (
    <Section tone={COLLAB_TONE}>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${push})`, transformOrigin: "1300px 560px" }}>
        <Place x={0} y={70} style={{ width: 1920, opacity: frame >= HEAD_AT ? 1 : 0 }}>
          <Headline lines={["collab with your", "team and agents."]} boxed="agents" tone={COLLAB_TONE} size={92} align={Align.Center} start={HEAD_AT} />
        </Place>
        <Place x={TERMINAL.x} y={TERMINAL.y} style={{ opacity: reveal, transform: `translate(${(1 - reveal) * 760}px, ${(1 - reveal) * 80}px) scale(${0.92 + 0.08 * reveal})`, transformOrigin: "100% 50%" }}>
          <Terminal />
        </Place>
        <Place x={cam.x} y={cam.y} style={{ transform: `scale(${cam.scale})`, transformOrigin: "0 0" }}>
          <div style={{ position: "relative" }}>
            <FeegaEditor state={state} />
            {dragging ? <LibraryGhost pick={0} x={pointer.x} y={pointer.y} t={(frame - GRAB_AT) / (DROP_AT - GRAB_AT)} /> : null}
            <Teammate frame={frame} scale={cam.scale} />
            {userCursor > 0 ? (
              <div style={{ opacity: userCursor }}>
                <Pointer x={pointer.x} y={pointer.y} pressed={dragging || Math.abs(frame - DROP_AT) < 3} scale={cam.scale / POINTER_SIZE} />
              </div>
            ) : null}
          </div>
        </Place>
      </div>
    </Section>
  );
};
