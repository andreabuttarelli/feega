import type { ReactNode } from "react";
import { siVscodium, siWindsurf } from "simple-icons";
import { useCurrentFrame } from "remotion";
import { FeegaMark, MARKS, Mark, type BrandMark } from "../../components/brandIcons";
import { Sound, type Cue } from "../../components/Sfx";
import { glide, lift, mix, tween } from "../../ease";
import { float } from "../motion";
import { Heading, Runner, Scatter, specks } from "../pixel";
import { Section } from "../Section";
import { INK, MONO, ORANGE, PAPER, Tone, UI } from "../style";

export const EDITORS_FRAMES = 105;
export const EDITORS_TONE = Tone.Paper;

const GAP_OPEN = 8;
const FIRST_SWAP = 16;
const SWAP_STEP = 11;
const FLIP = 7;
const CARD = { width: 500, height: 320 };
const FONT = 64;
const BOX = "0 0 24 24";

type Window = { name: string; mark?: BrandMark; color: string; chrome: string; terminal?: boolean };

const WINDOWS: Window[] = [
  { name: "VS Code", mark: MARKS.vscode, color: "#2f9cf4", chrome: "#1f1f1f" },
  { name: "Cursor", mark: MARKS.cursor, color: PAPER, chrome: "#141414" },
  { name: "Windsurf", mark: { path: siWindsurf.path, viewBox: BOX }, color: "#58e6c4", chrome: "#0d1413" },
  { name: "VSCodium", mark: { path: siVscodium.path, viewBox: BOX }, color: "#2f80ed", chrome: "#1b1d22" },
  { name: "npx feega", color: ORANGE, chrome: INK, terminal: true },
];

const DECK_TILT = [-7, 5, -4, 6, -2];
const DECK_SHIFT = [{ x: -26, y: -18 }, { x: 22, y: -12 }, { x: -14, y: 10 }, { x: 18, y: 6 }, { x: 0, y: 0 }];

export const swapAt = (i: number) => FIRST_SWAP + i * SWAP_STEP;

export const EDITORS_CUES: Cue[] = WINDOWS.map((_, i) => ({ at: swapAt(i), sound: Sound.ClickA, volume: 0.55 }));

const CODE_LINES = [0.62, 0.48, 0.7, 0.36, 0.55, 0.44, 0.66];

const FeegaPanel = () => (
  <div style={{ width: 150, borderLeft: "1px solid #2e2e2c", padding: "10px 10px", display: "flex", flexDirection: "column", gap: 7 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: UI, fontSize: 12, color: PAPER }}>
      <FeegaMark size={14} />
      Feega
    </div>
    {["Size", "Weight", "Fill", "Margin"].map((label, i) => (
      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: UI, fontSize: 10, color: "#8a8780" }}>
        {label}
        <span style={{ width: 46, height: 16, borderRadius: 4, background: i === 2 ? ORANGE : "#2a2a28" }} />
      </div>
    ))}
  </div>
);

const EditorBody = ({ accent }: { accent: string }) => (
  <div style={{ flex: 1, display: "flex" }}>
    <div style={{ width: 92, borderRight: "1px solid #2e2e2c", padding: "10px 8px", display: "flex", flexDirection: "column", gap: 7 }}>
      {[0.8, 0.6, 0.7, 0.5, 0.65].map((w, i) => (
        <span key={i} style={{ height: 6, width: `${w * 100}%`, borderRadius: 3, background: i === 2 ? accent : "#3a3a37" }} />
      ))}
    </div>
    <div style={{ flex: 1, padding: "12px 12px", display: "flex", flexDirection: "column", gap: 9 }}>
      {CODE_LINES.map((w, i) => (
        <span key={i} style={{ display: "flex", gap: 5 }}>
          <span style={{ height: 6, width: 18, borderRadius: 3, background: "#4a4a46" }} />
          <span style={{ height: 6, width: `${w * 100}%`, borderRadius: 3, background: i % 3 === 0 ? accent : "#5c5b57", opacity: i % 3 === 0 ? 0.8 : 1 }} />
        </span>
      ))}
    </div>
    <FeegaPanel />
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
    <div style={{ height: 38, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", borderBottom: "1px solid #2e2e2c" }}>
      {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
        <span key={c} style={{ width: 11, height: 11, borderRadius: 6, background: c }} />
      ))}
      <span style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, fontFamily: window.terminal ? MONO : UI, fontSize: 14, color: "#cfcdc7", marginRight: 54 }}>
        {window.mark ? <Mark mark={window.mark} size={16} color={window.color} /> : <span style={{ color: ORANGE }}>&gt;_</span>}
        {window.name}
      </span>
    </div>
    {window.terminal ? <TerminalBody /> : <EditorBody accent={window.color} />}
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

export const Editors = () => {
  const frame = useCurrentFrame();

  return (
    <Section tone={EDITORS_TONE} eyebrow="06 · editors">
      <Scatter specks={specks(6, 18, [ORANGE, "#004dff", "#c9c6bd"])} />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: FONT, letterSpacing: "-0.03em", color: INK, transform: `translateY(${float(frame, 0, 4)}px)` }}>
        <Words text="feega runs in" from={0} align="right" />
        <Slot>
          <Deck />
        </Slot>
        <Words text="your editor." from={4} align="left" />
      </div>
      <Runner sprite="ghost" size={8} y={930} from={30} frames={80} heading={Heading.Right} />
      <Runner sprite="blob" size={8} y={930} from={38} frames={80} heading={Heading.Right} />
    </Section>
  );
};
