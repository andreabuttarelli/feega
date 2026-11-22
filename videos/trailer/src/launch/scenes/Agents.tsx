import type { ReactNode } from "react";
import { siClaude, siCursor } from "simple-icons";
import { useCurrentFrame } from "remotion";
import { Mark } from "../../components/brandIcons";
import { Sound, type Cue } from "../../components/Sfx";
import { lift, mix, tween } from "../../ease";
import { EDITOR_REST, FeegaEditor, Press, pressAmount } from "../editor/FeegaEditor";
import { BASE_FONT, COPY_BUTTON, FONT_SIZE_FIELD, TABS, Tab, WIN, center, h1Rect, toStage, type Point, type Rect } from "../editor/layout";
import { Align, Headline } from "../Headline";
import { Pointer, pointerAt, type Click } from "../Pointer";
import { Place, Section } from "../Section";
import { MONO, PAPER, Tone, UI } from "../style";

export const AGENTS_FRAMES = 220;
export const AGENTS_TONE = Tone.Orange;
export const AGENTS_LINES = ["you edit.", "your agents build."];

const EDITOR_ORIGIN = { x: 130, y: 330 };
const EDITOR_SCALE = 0.74;
const TERMINAL: Rect = { x: 780, y: 380, w: 1010, h: 630 };
const BOX = "0 0 24 24";
const CLAUDE = `#${siClaude.hex}`;
const TARGET_FONT = 76;

const SELECT_AT = 34;
const SCRUB_AT = 46;
const SCRUB_END = 62;
const CHANGES_AT = 76;
const COPY_AT = 100;
const SWAP_AT = 118;
const PASTE_AT = 124;
const REPLY_AT = 146;
const DIFF_AT = 156;
const DIFF_STEP = 3;
const DONE_AT = 176;
const BACK_AT = 182;
const BUILD_AT = 186;
const POP = 10;

const stage = (r: Rect) => toStage(r, EDITOR_ORIGIN, EDITOR_SCALE);

const H1 = stage(h1Rect(BASE_FONT));
const SIZE = stage(FONT_SIZE_FIELD);
const CHANGES = stage(TABS[Tab.Changes]);
const COPY = stage(COPY_BUTTON);
const EDITOR_BOX = stage({ x: 0, y: 0, w: WIN.w, h: WIN.h });
const TERMINAL_PEEK: Rect = { x: EDITOR_BOX.x + EDITOR_BOX.w + 16, y: TERMINAL.y + 20, w: TERMINAL.x + TERMINAL.w - EDITOR_BOX.x - EDITOR_BOX.w - 32, h: TERMINAL.h - 40 };
const EDITOR_PEEK: Rect = { x: EDITOR_BOX.x + 16, y: EDITOR_BOX.y + 70, w: TERMINAL.x - EDITOR_BOX.x - 32, h: EDITOR_BOX.h - 90 };

const PATH = [
  { at: 18, x: 900, y: 1000 },
  { at: SELECT_AT - 6, x: H1.x + 90, y: H1.y + 24 },
  { at: SCRUB_AT - 4, ...center(SIZE) },
  { at: SCRUB_AT, ...center(SIZE) },
  { at: SCRUB_END, x: center(SIZE).x + 46, y: center(SIZE).y },
  { at: CHANGES_AT - 4, ...center(CHANGES) },
  { at: CHANGES_AT + 4, ...center(CHANGES) },
  { at: COPY_AT - 4, ...center(COPY) },
  { at: COPY_AT + 4, ...center(COPY) },
  { at: SWAP_AT - 4, ...center(TERMINAL_PEEK) },
  { at: SWAP_AT + 6, ...center(TERMINAL_PEEK) },
  { at: BACK_AT - 10, x: TERMINAL_PEEK.x + 120, y: TERMINAL_PEEK.y + 140 },
  { at: BACK_AT - 2, ...center(EDITOR_PEEK) },
];

export const AGENTS_CLICKS: Click[] = [
  { label: "select h1", at: SELECT_AT, path: PATH, rect: H1 },
  { label: "scrub size", at: SCRUB_AT, path: PATH, rect: SIZE },
  { label: "changes tab", at: CHANGES_AT, path: PATH, rect: CHANGES },
  { label: "copy for agent", at: COPY_AT, path: PATH, rect: COPY },
  { label: "terminal to front", at: SWAP_AT, path: PATH, rect: TERMINAL_PEEK },
  { label: "editor to front", at: BACK_AT, path: PATH, rect: EDITOR_PEEK },
];

const PROMPT = "build a refill plans section under the hero, same card style";

const CONTEXT = [
  ["element", "section.hero > h1.title"],
  ["source", "src/lib/Hero.svelte:14"],
  ["change", "font-size 64 → 76px"],
];

enum Line {
  Same = "same",
  Added = "added",
}

const LINE_COLOR: Record<Line, { fg: string; bg: string; sign: string }> = {
  [Line.Same]: { fg: "#a8a59e", bg: "transparent", sign: " " },
  [Line.Added]: { fg: "#9be3b4", bg: "rgba(80,220,140,.12)", sign: "+" },
};

const DIFF: { kind: Line; n: number; text: string }[] = [
  { kind: Line.Same, n: 24, text: '  <div class="actions">…</div>' },
  { kind: Line.Added, n: 25, text: '  <section class="plans">' },
  { kind: Line.Added, n: 26, text: "    <h2>Refill plans</h2>" },
  { kind: Line.Added, n: 27, text: "    {#each plans as plan}" },
  { kind: Line.Added, n: 28, text: "      <PlanCard {...plan} />" },
  { kind: Line.Added, n: 29, text: "    {/each}" },
  { kind: Line.Added, n: 30, text: "  </section>" },
];

const diffAt = (i: number) => DIFF_AT + i * DIFF_STEP;

export const AGENTS_CUES: Cue[] = [
  ...AGENTS_CLICKS.map((c) => ({ at: c.at, sound: Sound.ClickB, volume: 0.6 })),
  { at: SWAP_AT + 2, sound: Sound.Whoosh, volume: 0.3 },
  { at: BACK_AT + 2, sound: Sound.Whoosh, volume: 0.3 },
  { at: PASTE_AT, sound: Sound.Tap, volume: 0.4 },
  { at: REPLY_AT, sound: Sound.Pop, volume: 0.45 },
  ...DIFF.map((_, i) => ({ at: diffAt(i), sound: Sound.Tap, volume: 0.28 })),
  { at: DONE_AT, sound: Sound.Pop, volume: 0.4 },
  { at: BUILD_AT + 4, sound: Sound.Chime, volume: 0.35 },
];

const Appear = ({ at, children }: { at: number; children: ReactNode }) => {
  const frame = useCurrentFrame();

  if (frame < at) {
    return null;
  }

  const p = lift(frame, at, 10);
  return <div style={{ opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>{children}</div>;
};

const TABS_AGENT = [
  { name: "claude", mark: <Mark mark={{ path: siClaude.path, viewBox: BOX }} size={16} color={CLAUDE} /> },
  { name: "codex", mark: <span style={{ width: 16, height: 16, borderRadius: 4, background: "#f0eee9", color: "#0b0b0a", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center" }}>&gt;_</span> },
  { name: "cursor-agent", mark: <Mark mark={{ path: siCursor.path, viewBox: BOX }} size={16} color="#f0eee9" /> },
];

const Terminal = () => {
  const frame = useCurrentFrame();
  const typed = Math.max(0, Math.floor((frame - PASTE_AT) * 3.2));
  const thinking = frame >= PASTE_AT + 14 && frame < REPLY_AT;
  const spinner = "✻✳✢·"[Math.floor(frame / 3) % 4];

  return (
    <div style={{ width: TERMINAL.w, height: TERMINAL.h, borderRadius: 14, overflow: "hidden", background: "#141413", boxShadow: "0 0 0 1px #3a3a38, 0 40px 100px rgba(0,0,0,.45)", fontFamily: MONO, fontSize: 19, color: "#e9e7e2", display: "flex", flexDirection: "column" }}>
      <div style={{ height: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", background: "#1d1d1c", borderBottom: "1px solid #2e2e2c", fontFamily: UI, fontSize: 14 }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
        ))}
        <div style={{ display: "flex", gap: 4, marginLeft: 18 }}>
          {TABS_AGENT.map((tab, i) => (
            <span key={tab.name} style={{ display: "flex", alignItems: "center", gap: 8, height: 30, padding: "0 14px", borderRadius: 7, background: i === 0 ? "#2c2c2a" : "transparent", color: i === 0 ? "#f0eee9" : "#8a8780" }}>
              {tab.mark}
              {tab.name}
            </span>
          ))}
        </div>
        <span style={{ marginLeft: "auto", color: "#8a8780" }}>~/aurel</span>
      </div>
      <div style={{ flex: 1, padding: "18px 24px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
        <div style={{ border: `1.5px solid ${CLAUDE}`, borderRadius: 10, padding: "10px 16px", width: 520 }}>
          <div>
            <span style={{ color: CLAUDE }}>✻</span> Welcome to <b>Claude Code</b>
          </div>
          <div style={{ color: "#8a8780", fontSize: 16 }}>cwd: ~/aurel · feega context on</div>
        </div>
        {frame >= PASTE_AT ? (
          <div style={{ borderRadius: 10, background: "#1f1f1e", padding: "10px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#ff8a3d", fontSize: 16 }}>
              <span style={{ width: 9, height: 9, background: "#ff5100" }} />
              pasted from Feega · 1 element · 2 changes
            </div>
            {CONTEXT.map(([key, value]) => (
              <div key={key} style={{ display: "flex", gap: 16, fontSize: 16 }}>
                <span style={{ width: 80, color: "#8a8780" }}>{key}</span>
                {value}
              </div>
            ))}
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
            {spinner} Reading Hero.svelte… <span style={{ color: "#8a8780" }}>(esc to interrupt)</span>
          </div>
        ) : null}
        <Appear at={REPLY_AT}>
          <div>
            <span style={{ color: "#e9e7e2" }}>⏺</span> I'll add a refill plans section below the hero, reusing your card styles.
          </div>
        </Appear>
        <Appear at={DIFF_AT - 4}>
          <div>
            <span style={{ color: "#3ccf6e" }}>⏺</span> <b>Update</b>(src/lib/Hero.svelte)
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
            ✓ <span style={{ color: "#e9e7e2" }}>2 files changed · PlanCard.svelte created</span>
          </div>
        </Appear>
      </div>
    </div>
  );
};

enum Front {
  Editor = "editor",
  Terminal = "terminal",
}

const frontAt = (frame: number) => (frame >= SWAP_AT && frame < BACK_AT ? Front.Terminal : Front.Editor);

const raise = (frame: number, front: Front, who: Front) => {
  const since = who === Front.Terminal ? SWAP_AT : BACK_AT;
  const pop = who === front && frame >= since ? Math.sin(Math.PI * Math.min(1, (frame - since) / POP)) * 0.025 : 0;
  return { scale: (who === front ? 1 : 0.97) + pop, dim: who === front ? 1 : 0.78, z: who === front ? 2 : 1 };
};

const cameraAt = (frame: number): { zoom: number; focus: Point } => {
  const edit = 0.14 * tween(frame, 38, 16) - 0.14 * tween(frame, 104, 12);
  const talk = 0.22 * tween(frame, PASTE_AT, 14) - 0.22 * tween(frame, DONE_AT + 2, 10);
  const editFocus = { x: SIZE.x, y: SIZE.y };
  const message = { x: TERMINAL.x + 120, y: TERMINAL.y + 200 };
  const reply = { x: TERMINAL.x + 200, y: TERMINAL.y + 470 };
  const toReply = tween(frame, REPLY_AT, 18);
  const inTerminal = frame >= SWAP_AT;
  const focus = inTerminal ? { x: mix(message.x, reply.x, toReply), y: mix(message.y, reply.y, toReply) } : editFocus;

  return { zoom: 1 + edit + talk, focus };
};

export const Agents = () => {
  const frame = useCurrentFrame();
  const enter = tween(frame, 4, 18);
  const behind = tween(frame, 10, 18);
  const front = frontAt(frame);
  const editor = raise(frame, front, Front.Editor);
  const terminal = raise(frame, front, Front.Terminal);
  const pointer = pointerAt(frame, PATH);
  const cam = cameraAt(frame);
  const scrubbing = frame >= SCRUB_AT - 2 && frame < SCRUB_END + 2;
  const tab = frame >= CHANGES_AT ? Tab.Changes : Tab.Properties;
  const editorState = {
    ...EDITOR_REST,
    tab,
    hover: tween(frame, SELECT_AT - 6, 6),
    selected: tween(frame, SELECT_AT, 6),
    fontSize: Math.round(mix(BASE_FONT, TARGET_FONT, tween(frame, SCRUB_AT, SCRUB_END - SCRUB_AT))),
    scrub: scrubbing,
    changes: Math.max(0, (frame - CHANGES_AT - 2) / 2),
    copied: frame >= COPY_AT ? 1 : 0,
    built: tween(frame, BUILD_AT, 18),
    presses: [
      { rect: h1Rect(BASE_FONT), amount: pressAmount(frame, SELECT_AT) },
      { rect: FONT_SIZE_FIELD, amount: pressAmount(frame, SCRUB_AT) },
      { rect: TABS[Tab.Changes], amount: pressAmount(frame, CHANGES_AT) },
      { rect: COPY_BUTTON, amount: pressAmount(frame, COPY_AT) },
    ],
  };

  return (
    <Section tone={AGENTS_TONE} eyebrow="07 · agents">
      <div style={{ position: "absolute", inset: 0, transform: `scale(${cam.zoom})`, transformOrigin: `${cam.focus.x}px ${cam.focus.y}px` }}>
        <Place x={0} y={80} style={{ width: 1920, opacity: 1 - 0.85 * tween(frame, SWAP_AT, 10) + 0.85 * tween(frame, BACK_AT, 10) }}>
          <Headline lines={AGENTS_LINES} boxed="build" tone={AGENTS_TONE} size={104} align={Align.Center} />
        </Place>
        <Place x={TERMINAL.x} y={TERMINAL.y} style={{ zIndex: terminal.z, transform: `translateX(${(1 - behind) * 1100}px) scale(${terminal.scale})`, filter: `brightness(${terminal.dim})` }}>
          <Terminal />
        </Place>
        <Place x={EDITOR_ORIGIN.x} y={EDITOR_ORIGIN.y} style={{ zIndex: editor.z, transform: `translateY(${(1 - enter) * 800}px) scale(${EDITOR_SCALE * editor.scale})`, transformOrigin: "0 0", filter: `brightness(${editor.dim})` }}>
          <FeegaEditor state={editorState} />
        </Place>
        <div style={{ position: "absolute", inset: 0, zIndex: 3 }}>
          <Press rect={TERMINAL_PEEK} amount={pressAmount(frame, SWAP_AT) * 0.6} />
          <Press rect={EDITOR_PEEK} amount={pressAmount(frame, BACK_AT) * 0.6} />
          {frame >= PATH[0].at ? <Pointer x={pointer.x} y={pointer.y} pressed={scrubbing || AGENTS_CLICKS.some((c) => Math.abs(frame - c.at) < 3)} scale={cam.zoom} /> : null}
        </div>
      </div>
    </Section>
  );
};
