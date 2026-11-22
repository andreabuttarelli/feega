import type { ReactNode } from "react";
import { siClaude, siCursor, siGooglegemini } from "simple-icons";
import { useCurrentFrame } from "remotion";
import { Mark } from "../../components/brandIcons";
import { Sound, type Cue } from "../../components/Sfx";
import { lift, tween } from "../../ease";
import { Align, Headline } from "../Headline";
import { Pixel, hop } from "../pixel";
import { Pointer, pointerAt } from "../Pointer";
import { Place, Section } from "../Section";
import { DISPLAY, INK, MONO, ORANGE, PAPER, Tone, UI } from "../style";

export const AGENTS_FRAMES = 120;
export const AGENTS_TONE = Tone.Orange;
export const AGENTS_LINES = ["works with your agent."];

const BOX = "0 0 24 24";
const PANEL = { x: 260, y: 300, width: 1400, height: 690 };
const LIST_W = 470;
const ROW_H = 104;
const LIST_TOP = 70;
const PICKED = 0;
const CLICK = 30;
const CONTEXT_AT = 38;
const LINE_STEP = 5;
const TYPING_AT = 64;
const REPLY_AT = 76;
const DIFF_STEP = 4;
const LINE = "#e6e3dc";
const DIM = "#8a8780";
const TEXT = "#1d1c1a";

const Avatar = ({ children, bg }: { children: ReactNode; bg: string }) => (
  <div style={{ width: 54, height: 54, borderRadius: 14, background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{children}</div>
);

const CHATS = [
  { name: "Claude Code", preview: "Updated the hero heading.", time: "now", avatar: <Avatar bg="#f6ece4"><Mark mark={{ path: siClaude.path, viewBox: BOX }} size={32} color={`#${siClaude.hex}`} /></Avatar> },
  { name: "Codex", preview: "Tests pass on the pricing page.", time: "2m", avatar: <Avatar bg={INK}><span style={{ fontFamily: DISPLAY, fontWeight: 600, fontSize: 17, letterSpacing: "-0.04em", color: PAPER }}>codex</span></Avatar> },
  { name: "Cursor", preview: "Applied the spacing change.", time: "9m", avatar: <Avatar bg={INK}><Mark mark={{ path: siCursor.path, viewBox: BOX }} size={30} color={PAPER} /></Avatar> },
  { name: "Gemini CLI", preview: "Footer links now open in a tab.", time: "1h", avatar: <Avatar bg="#eef2fd"><Mark mark={{ path: siGooglegemini.path, viewBox: BOX }} size={30} color={`#${siGooglegemini.hex}`} /></Avatar> },
];

const CONTEXT = [
  ["selector", "main > h1.hero"],
  ["file", "src/routes/+page.svelte:12"],
  ["change", "font-size 64 → 72px"],
  ["change", "color #0b0b0a → #ff5100"],
];

const DIFF = [
  { sign: "-", text: "font-size: 64px;", bg: "#fde8e6", fg: "#b42318" },
  { sign: "+", text: "font-size: 72px;", bg: "#e5f6ea", fg: "#18794e" },
  { sign: "-", text: "color: #0b0b0a;", bg: "#fde8e6", fg: "#b42318" },
  { sign: "+", text: "color: #ff5100;", bg: "#e5f6ea", fg: "#18794e" },
];

const contextAt = (i: number) => CONTEXT_AT + i * LINE_STEP;
const diffAt = (i: number) => REPLY_AT + 8 + i * DIFF_STEP;

export const AGENTS_CUES: Cue[] = [
  { at: CLICK, sound: Sound.ClickB, volume: 0.6 },
  ...CONTEXT.map((_, i) => ({ at: contextAt(i), sound: Sound.Tap, volume: 0.35 })),
  { at: REPLY_AT, sound: Sound.Pop, volume: 0.45 },
  ...DIFF.map((_, i) => ({ at: diffAt(i), sound: Sound.Tap, volume: 0.3 })),
];

const Appear = ({ at, children }: { at: number; children: ReactNode }) => {
  const frame = useCurrentFrame();
  const p = lift(frame, at, 10);

  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>{children}</div>;
};

const Typing = () => {
  const frame = useCurrentFrame();

  if (frame < TYPING_AT || frame >= REPLY_AT) {
    return null;
  }

  return (
    <div style={{ display: "flex", gap: 6, padding: "14px 18px", background: "#f2f0eb", borderRadius: 16, width: "fit-content" }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 9, height: 9, borderRadius: 5, background: DIM, opacity: 0.4 + 0.6 * Math.abs(Math.sin((frame + i * 4) / 5)) }} />
      ))}
    </div>
  );
};

export const Agents = () => {
  const frame = useCurrentFrame();
  const panel = tween(frame, 4, 16);
  const selected = frame >= CLICK;
  const pointer = pointerAt(frame, [
    { at: 12, x: 700, y: 760 },
    { at: CLICK - 2, x: 320, y: LIST_TOP + PICKED * ROW_H + 60 },
    { at: CLICK + 14, x: 360, y: LIST_TOP + PICKED * ROW_H + 70 },
  ]);

  return (
    <Section tone={AGENTS_TONE} eyebrow="08 · agents">
      <Place x={0} y={120} style={{ width: 1920 }}>
        <Headline lines={AGENTS_LINES} boxed="agent" tone={AGENTS_TONE} size={110} align={Align.Center} />
      </Place>
      <Place x={PANEL.x} y={PANEL.y} style={{ transform: `translateY(${(1 - panel) * 500}px)` }}>
        <div style={{ position: "relative", width: PANEL.width, height: PANEL.height, borderRadius: 22, background: "#fbfaf7", boxShadow: "0 40px 90px rgba(0,0,0,.25)", display: "flex", overflow: "hidden", fontFamily: UI, color: TEXT }}>
          <div style={{ width: LIST_W, borderRight: `1px solid ${LINE}`, background: "#f5f3ee" }}>
            <div style={{ height: LIST_TOP, display: "flex", alignItems: "center", padding: "0 26px", fontSize: 22, fontWeight: 600 }}>Agents</div>
            {CHATS.map((chat, i) => {
              const on = selected && i === PICKED;

              return (
                <div key={chat.name} style={{ height: ROW_H, display: "flex", alignItems: "center", gap: 16, padding: "0 22px", margin: "0 10px", borderRadius: 14, background: on ? ORANGE : "transparent", color: on ? PAPER : TEXT }}>
                  {chat.avatar}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 21, fontWeight: 600 }}>
                      {chat.name}
                      <span style={{ fontSize: 15, fontWeight: 400, color: on ? PAPER : DIM }}>{chat.time}</span>
                    </div>
                    <div style={{ fontSize: 17, color: on ? PAPER : DIM, marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{chat.preview}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ height: LIST_TOP, display: "flex", alignItems: "center", gap: 12, padding: "0 28px", borderBottom: `1px solid ${LINE}`, fontSize: 21, fontWeight: 600, opacity: selected ? 1 : 0.3 }}>
              <Mark mark={{ path: siClaude.path, viewBox: BOX }} size={24} color={`#${siClaude.hex}`} />
              Claude Code
            </div>
            <div style={{ flex: 1, padding: "28px 32px", display: "flex", flexDirection: "column", gap: 18 }}>
              {frame >= CONTEXT_AT ? (
                <div style={{ alignSelf: "flex-end", width: 560, background: INK, color: PAPER, borderRadius: 18, padding: "18px 22px", fontFamily: MONO, fontSize: 19, lineHeight: 1.6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, color: ORANGE, marginBottom: 6 }}>
                    <span style={{ width: 10, height: 10, background: ORANGE }} />
                    feega · copy for agent
                  </div>
                  {CONTEXT.map(([key, value], i) =>
                    frame >= contextAt(i) ? (
                      <div key={i} style={{ display: "flex", gap: 18 }}>
                        <span style={{ width: 96, color: DIM }}>{key}</span>
                        <span>{value.slice(0, Math.ceil((frame - contextAt(i) + 1) * 6))}</span>
                      </div>
                    ) : null,
                  )}
                </div>
              ) : null}
              <Typing />
              {frame >= REPLY_AT ? (
                <Appear at={REPLY_AT}>
                  <div style={{ width: 600, background: "#f2f0eb", borderRadius: 18, padding: "18px 22px" }}>
                    <div style={{ fontSize: 21 }}>
                      Done — updated <span style={{ fontFamily: MONO, fontSize: 19 }}>src/routes/+page.svelte</span>
                    </div>
                    <div style={{ marginTop: 12, borderRadius: 10, overflow: "hidden", border: `1px solid ${LINE}`, fontFamily: MONO, fontSize: 18 }}>
                      {DIFF.map((d, i) =>
                        frame >= diffAt(i) ? (
                          <div key={i} style={{ display: "flex", gap: 14, padding: "6px 14px", background: d.bg, color: d.fg }}>
                            <span style={{ color: DIM }}>{12 + Math.floor(i / 2)}</span>
                            <span>{d.sign}</span>
                            {d.text}
                          </div>
                        ) : null,
                      )}
                    </div>
                  </div>
                </Appear>
              ) : null}
            </div>
          </div>
          {frame >= 12 ? <Pointer x={pointer.x} y={pointer.y} pressed={Math.abs(frame - CLICK) < 3} /> : null}
        </div>
      </Place>
      <Place x={1640} y={990} style={{ transform: `translateY(${hop(frame, 0) - (1 - lift(frame, 50, 10)) * -120}px)` }}>
        <Pixel sprite="blob" size={9} />
      </Place>
    </Section>
  );
};
