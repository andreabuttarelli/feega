import type { ReactNode } from "react";
import { siVscodium, siWindsurf } from "simple-icons";
import { useCurrentFrame } from "remotion";
import { FeegaMark, MARKS, Mark, type BrandMark } from "../../components/brandIcons";
import { Sound, type Cue } from "../../components/Sfx";
import { glide, lift, mix, tween } from "../../ease";
import { float } from "../motion";
import { Heading, Tumble, Scatter, specks } from "../pixel";
import { Section } from "../Section";
import { INK, MONO, ORANGE, PAPER, Tone, UI } from "../style";
import { EDITOR_REST, FeegaEditor } from "../editor/FeegaEditor";
import { WIN } from "../editor/layout";

export const EDITORS_FRAMES = 100;
export const EDITORS_TONE = Tone.White;

const GAP_OPEN = 8;
const FIRST_SWAP = 16;
const SWAP_STEP = 11;
const FLIP = 7;
const CARD = { width: 660, height: 430 };
const FONT = 64;
const BOX = "0 0 24 24";

type Window = { name: string; mark?: BrandMark; color: string; chrome: string; status: string; terminal?: boolean };

const WINDOWS: Window[] = [
  { name: "VS Code", mark: MARKS.vscode, color: "#2f9cf4", chrome: "#181818", status: "#007acc" },
  { name: "Cursor", mark: MARKS.cursor, color: PAPER, chrome: "#0e0e0e", status: "#2a2a2a" },
  { name: "Windsurf", mark: { path: siWindsurf.path, viewBox: BOX }, color: "#58e6c4", chrome: "#0b1a17", status: "#0f8a72" },
  { name: "VSCodium", mark: { path: siVscodium.path, viewBox: BOX }, color: "#2f80ed", chrome: "#1b1d22", status: "#3b5bdb" },
  { name: "npx feega", color: ORANGE, chrome: INK, status: ORANGE, terminal: true },
];

const DECK_TILT = [-7, 5, -4, 6, -2];
const DECK_SHIFT = [{ x: -26, y: -18 }, { x: 22, y: -12 }, { x: -14, y: 10 }, { x: 18, y: 6 }, { x: 0, y: 0 }];

export const swapAt = (i: number) => FIRST_SWAP + i * SWAP_STEP;

export const EDITORS_CUES: Cue[] = WINDOWS.map((_, i) => ({ at: swapAt(i), sound: Sound.ClickA, volume: 0.55 }));

const ACTIVITY_W = 46;
const TITLE_H = 38;
const STATUS_H = 24;
const MINI = Math.min((CARD.width - ACTIVITY_W) / WIN.w, (CARD.height - TITLE_H - STATUS_H) / WIN.h);

const EditorBody = ({ window }: { window: Window }) => (
  <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
    <div style={{ width: ACTIVITY_W, background: window.chrome, borderRight: "1px solid #2e2e2c", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 12 }}>
      {window.mark ? <Mark mark={window.mark} size={24} color={window.color} /> : null}
      {[0, 1, 2, 3].map((i) => (
        <span key={i} style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${i === 3 ? ORANGE : "#5c5b57"}` }} />
      ))}
    </div>
    <div style={{ flex: 1, background: "#1f1f1f", overflow: "hidden" }}>
      <div style={{ transform: `scale(${MINI})`, transformOrigin: "0 0" }}>
        <FeegaEditor state={{ ...EDITOR_REST, selected: 1, hover: 1 }} />
      </div>
    </div>
  </div>
);

const TerminalBody = () => (
  <div style={{ flex: 1, padding: "18px 20px", fontFamily: MONO, fontSize: 19, lineHeight: 1.7, color: PAPER }}>
    <div>
      <span style={{ color: ORANGE }}>$</span> npx feega
    </div>
    <div style={{ color: "#8a8780" }}>detected sveltekit · vite</div>
    <div style={{ color: "#8a8780" }}>source map plugin added</div>
    <div>
      <span style={{ color: "#3ccf6e" }}>✓</span> feega on localhost:5173
    </div>
  </div>
);

const WindowCard = ({ window }: { window: Window }) => (
  <div style={{ width: CARD.width, height: CARD.height, borderRadius: 14, background: window.chrome, border: "1px solid #2e2e2c", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 24px 50px rgba(0,0,0,.28)" }}>
    <div style={{ height: TITLE_H, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", borderBottom: "1px solid #2e2e2c", background: window.chrome }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <span key={c} style={{ width: 11, height: 11, borderRadius: 6, background: c }} />
      ))}
      <span style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, fontFamily: window.terminal ? MONO : UI, fontSize: 15, color: "#cfcdc7", marginRight: 54 }}>
        {window.mark ? <Mark mark={window.mark} size={16} color={window.color} /> : <span style={{ color: ORANGE }}>&gt;_</span>}
        {window.name}
      </span>
    </div>
    {window.terminal ? <TerminalBody /> : <EditorBody window={window} />}
    <div style={{ height: STATUS_H, background: window.status, display: "flex", alignItems: "center", gap: 10, padding: "0 12px", fontFamily: UI, fontSize: 12, color: "#fff" }}>
      <FeegaMark size={12} />
      Feega · localhost:5173
    </div>
  </div>
);

const Deck = () => {
  const frame = useCurrentFrame();

  return (
    <div style={{ position: "relative", width: CARD.width, height: CARD.height, perspective: 1200 }}>
      {WINDOWS.map((window, i) => {
        const at = swapAt(i);

        if (frame < at) {
          return null;
        }

        const flip = tween(frame, at, FLIP);
        const buried = WINDOWS.filter((_, k) => k > i && frame >= swapAt(k)).length;
        const settle = Math.min(buried, 1);
        const tilt = mix(DECK_TILT[i] * 2.4, DECK_TILT[i], flip) * (buried ? 1 : 0.4 + 0.6 * flip);
        const shift = DECK_SHIFT[(i + 1) % DECK_SHIFT.length];

        return (
          <div key={window.name} style={{ position: "absolute", inset: 0, transform: `translate(${shift.x * settle}px, ${shift.y * settle - (1 - flip) * 60}px) rotateX(${(1 - flip) * 70}deg) rotate(${tilt}deg) scale(${mix(0.7, 1, flip) - 0.03 * buried})`, transformOrigin: "50% 100%", filter: `brightness(${1 - 0.12 * Math.min(buried, 3)})` }}>
            <WindowCard window={window} />
          </div>
        );
      })}
    </div>
  );
};

const Words = ({ text, from, align }: { text: string; from: number; align: "left" | "right" }) => {
  const frame = useCurrentFrame();
  const p = lift(frame, from, 12);

  return <span style={{ display: "inline-block", whiteSpace: "nowrap", textAlign: align, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>{text}</span>;
};

const Slot = ({ children }: { children: ReactNode }) => {
  const frame = useCurrentFrame();
  const open = glide(frame, GAP_OPEN, 10);

  return <span style={{ display: "inline-flex", justifyContent: "center", width: open * (CARD.width + 60), height: CARD.height }}>{children}</span>;
};

const Label = () => {
  const frame = useCurrentFrame();
  const top = WINDOWS.reduce((current, _, i) => (frame >= swapAt(i) ? i : current), -1);

  if (top < 0) {
    return null;
  }

  const window = WINDOWS[top];
  const p = lift(frame, swapAt(top), 8);

  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 540 + CARD.height / 2 + 56, display: "flex", justifyContent: "center", alignItems: "center", gap: 14, fontFamily: MONO, fontSize: 34, color: INK, opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
      {window.mark ? <Mark mark={window.mark} size={30} color={window.status} /> : <span style={{ color: ORANGE }}>&gt;_</span>}
      {window.name}
    </div>
  );
};

export const Editors = () => {
  const frame = useCurrentFrame();

  return (
    <Section tone={EDITORS_TONE} eyebrow="05 · editors">
      <Scatter specks={specks(6, 18, [ORANGE, "#004dff", "#c9c6bd"])} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: FONT, letterSpacing: "-0.03em", color: INK, transform: `translateY(${float(frame, 0, 4)}px)` }}>
        <Words text="feega runs in" from={0} align="right" />
        <Slot>
          <Deck />
        </Slot>
        <Words text="your editor." from={4} align="left" />
      </div>
      <Label />
      <Tumble sprite="code" size={8} y={140} from={30} frames={80} heading={Heading.Right} />
      <Tumble sprite="palette" size={8} y={150} from={38} frames={80} heading={Heading.Right} />
    </Section>
  );
};
